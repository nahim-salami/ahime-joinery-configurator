<?php
/**
 * Pourquoi ce fichier existe : la configuration POSTÉE par le navigateur ne
 * passe dans le panier qu'à travers une LISTE BLANCHE.
 *
 * Revue de l'annuaire WordPress.org, 9 octobre 2026 : le panier décodait le
 * JSON du formulaire et le rangeait entier dans la session puis dans la
 * commande. Rien n'y était exécuté, mais rien n'y était borné non plus : une
 * clé inventée, un texte de dix mégaoctets ou une couleur hors catalogue
 * voyageaient jusqu'à l'atelier.
 *
 * La liste blanche est `schema-configuration.php`, ÉCRIT par le compilateur à
 * partir du type `JoineryConfiguration` du cœur
 * (scripts/generer-schema-configuration.ts) : chaque clé connue, son type,
 * ses valeurs permises, ses champs obligatoires, récursivement. Ce fichier ne
 * fait que la LIRE. Une clé inconnue, un type faux, une valeur hors de son
 * énumération ou hors de ses bornes : la configuration entière est refusée.
 * On ne « répare » rien en silence — un champ retiré sans le dire serait une
 * option payée et non fabriquée.
 *
 * Le texte libre passe par `sanitize_text_field()`. L'appartenance au
 * CATALOGUE du marchand (une couleur qu'il ne vend pas, une famille absente)
 * est vérifiée ensuite par le moteur : `AHJC_Pricing::valeurs_inconnues()` et
 * la validation.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Configuration
{
    /** Au-delà, ce n'est pas une menuiserie : c'est un envoi. */
    public const OCTETS_MAX = 32768;

    /** La profondeur d'imbrication du JSON accepté. */
    public const PROFONDEUR_MAX = 8;

    /** @var array<string,mixed> */
    private array $schema;

    /** @param array<string,mixed> $schema */
    public function __construct(array $schema)
    {
        $this->schema = $schema;
    }

    public static function depuis_le_schema_livre(): self
    {
        return new self(require __DIR__ . '/schema-configuration.php');
    }

    /**
     * Le JSON reçu, décodé et filtré — ou une exception qui dit pourquoi.
     *
     * @param array<int,string> $familles les familles du catalogue retenu
     * @return array<string,mixed>
     */
    public function lire(string $json, array $familles): array
    {
        if ($json === '' || strlen($json) > self::OCTETS_MAX) {
            throw new InvalidArgumentException(esc_html('configuration vide ou trop longue'));
        }
        $brute = json_decode($json, true, self::PROFONDEUR_MAX);
        if (!is_array($brute) || json_last_error() !== JSON_ERROR_NONE) {
            throw new InvalidArgumentException(esc_html('configuration illisible'));
        }
        $config = $this->nettoyer($brute, $this->schema, 'configuration');
        if (!in_array($config['famille'], $familles, true)) {
            throw new InvalidArgumentException(esc_html('famille absente du catalogue'));
        }
        return $config;
    }

    /**
     * Une valeur contre son schéma. Rend la valeur nettoyée, ou lève.
     *
     * @param mixed $valeur
     * @param array<string,mixed> $schema
     * @return mixed
     */
    public function nettoyer($valeur, array $schema, string $chemin)
    {
        switch ($schema['type']) {
            case 'objet':
                if (!is_array($valeur) || ($valeur !== [] && array_is_list($valeur))) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : objet attendu"));
                }
                $propre = [];
                foreach ($valeur as $cle => $sous) {
                    $cle = (string) $cle;
                    if (!isset($schema['champs'][$cle])) {
                        throw new InvalidArgumentException(esc_html("{$chemin} : champ inconnu « " . sanitize_key($cle) . ' »'));
                    }
                    $propre[$cle] = $this->nettoyer($sous, $schema['champs'][$cle], "{$chemin}.{$cle}");
                }
                foreach ($schema['requis'] as $requis) {
                    if (!array_key_exists($requis, $propre)) {
                        throw new InvalidArgumentException(esc_html("{$chemin}.{$requis} : champ obligatoire absent"));
                    }
                }
                return $propre;

            case 'liste':
                if (!is_array($valeur) || !array_is_list($valeur)) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : liste attendue"));
                }
                $n = count($valeur);
                if ($n > $schema['max'] || $n < ($schema['min'] ?? 0)) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : {$n} éléments, hors des bornes"));
                }
                $propre = [];
                foreach ($valeur as $index => $sous) {
                    $propre[] = $this->nettoyer($sous, $schema['element'], "{$chemin}[{$index}]");
                }
                return $propre;

            case 'nombre':
                if (!is_int($valeur) && !is_float($valeur)) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : nombre attendu"));
                }
                if (!is_finite((float) $valeur) || $valeur < $schema['min'] || $valeur > $schema['max']) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : hors des bornes"));
                }
                if (!empty($schema['entier'])) {
                    if ((float) $valeur !== floor((float) $valeur)) {
                        throw new InvalidArgumentException(esc_html("{$chemin} : entier attendu"));
                    }
                    return absint($valeur);
                }
                return $valeur;

            case 'booleen':
                if (!is_bool($valeur)) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : booléen attendu"));
                }
                return $valeur;

            case 'texte':
                if (!is_string($valeur) || strlen($valeur) > $schema['max']) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : texte attendu"));
                }
                return sanitize_text_field($valeur);

            case 'enum':
                if ((!is_string($valeur) && !is_int($valeur)) || !in_array($valeur, $schema['valeurs'], true)) {
                    throw new InvalidArgumentException(esc_html("{$chemin} : valeur non permise"));
                }
                return is_string($valeur) ? sanitize_text_field($valeur) : $valeur;

            case 'union':
                foreach ($schema['choix'] as $choix) {
                    try {
                        return $this->nettoyer($valeur, $choix, $chemin);
                    } catch (InvalidArgumentException $erreur) {
                        continue;
                    }
                }
                throw new InvalidArgumentException(esc_html("{$chemin} : aucune forme permise"));
        }
        throw new InvalidArgumentException(esc_html("{$chemin} : schéma inconnu"));
    }
}
