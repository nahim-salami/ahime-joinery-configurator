<?php
/**
 * Pourquoi ce fichier existe : c'est LUI qui applique « le prix du navigateur
 * n'écrit jamais une commande » (docs/00 §8). Le moteur PHP existait et
 * personne ne l'appelait ; ce fichier est son appelant.
 *
 * CE QUI ARRIVE DU NAVIGATEUR : une CONFIGURATION, jamais un montant. C'est
 * la raison pour laquelle le panier du widget envoie l'objet entier — le
 * commentaire en tête de `etat.ts` l'annonçait depuis la phase 2. Un montant
 * posté serait un montant à croire, et il suffit d'une console ouverte pour
 * acheter une baie coulissante à un euro.
 *
 * LE PRIX DU NAVIGATEUR EST QUAND MÊME REÇU, et c'est délibéré : pas pour le
 * croire, pour le COMPARER. Un écart entre les deux n'est presque jamais une
 * fraude — c'est un catalogue mis à jour pendant que le client remplissait
 * son panier. Le distinguer permet de dire au client « le tarif a changé,
 * voici le nouveau prix » au lieu de « refusé », qui le fait partir.
 *
 * TROIS PORTES, ET UNE SEULE VÉRITÉ :
 *   1. l'ajout au panier RECALCULE et écrit le prix du serveur ;
 *   2. chaque recalcul du panier par WooCommerce le REFAIT — une remise
 *      quantité qui bascule doit basculer aussi ;
 *   3. la ligne de commande PORTE la configuration entière, parce que
 *      l'atelier fabrique d'après elle et non d'après un libellé.
 *
 * ET CE QUI ARRIVE DU NAVIGATEUR EST FILTRÉ AVANT D'ÊTRE LU (revue de
 * l'annuaire WordPress.org, 9 octobre 2026). Le JSON passe la liste blanche
 * de `AHJC_Configuration` (clés connues, types, énumérations, bornes), puis
 * les valeurs inconnues du catalogue, la validation et le chiffrage ; le
 * moindre refus refuse l'ajout, avec un avis qui le dit. Une ligne que le
 * panier ne sait plus chiffrer (le catalogue a changé entre-temps) est
 * RETIRÉE, au lieu de rester au prix du produit nu.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

final class AHJC_Panier
{
    /** La clé sous laquelle la configuration voyage dans le panier et la commande. */
    public const CLE = '_ahjc_configuration';

    /** La clé du prix que le navigateur annonçait — gardée pour le DIRE, jamais pour le croire. */
    public const CLE_PRIX_ANNONCE = '_ahjc_prix_annonce_cents';

    /** L'action du jeton de l'ajout au panier. */
    public const JETON = 'ahjc_ajout';

    private AHJC_Pricing $pricing;
    private AHJC_Catalogue $catalogue;
    private AHJC_Validate $validate;
    private AHJC_Configuration $liste_blanche;

    /**
     * La configuration de la requête en cours, une fois filtrée et acceptée :
     * la validation de l'ajout la lit, l'ajout la range. `null` tant qu'aucune
     * n'a passé tous les contrôles.
     *
     * @var array<string,mixed>|null
     */
    private ?array $acceptee = null;

    public function __construct(AHJC_Catalogue $catalogue, AHJC_Pricing $pricing, AHJC_Validate $validate)
    {
        $this->catalogue = $catalogue;
        $this->pricing = $pricing;
        $this->validate = $validate;
        $this->liste_blanche = AHJC_Configuration::depuis_le_schema_livre();
    }

    public function brancher(): void
    {
        add_filter('woocommerce_add_to_cart_validation', [$this, 'refuser_l_infabricable'], 10, 2);
        add_filter('woocommerce_add_cart_item_data', [$this, 'attacher_la_configuration'], 10, 2);
        add_action('woocommerce_before_calculate_totals', [$this, 'recalculer_le_panier'], 20);
        add_filter('woocommerce_get_item_data', [$this, 'afficher_la_configuration'], 10, 2);
        add_action('woocommerce_checkout_create_order_line_item', [$this, 'figer_dans_la_commande'], 10, 4);
    }

    /**
     * Les contrôles qu'une configuration passe AVANT d'entrer au panier, et
     * chaque fois qu'il est recalculé : valeurs connues du catalogue, aucune
     * erreur de validation, un prix calculable. Rend les motifs de refus
     * (vide = acceptée).
     *
     * IL NE REFUSE QUE LES ERREURS, jamais les avertissements. « Pose en
     * applique sans tapée » est une remarque de métier, pas un défaut de
     * fabrication : bloquer dessus ferait perdre une vente qui était bonne.
     *
     * @param array<string,mixed> $config
     * @return array<int,string>
     */
    private function motifs_de_refus(array $config): array
    {
        try {
            if ($this->pricing->valeurs_inconnues($config) !== []) {
                return [__('Cette configuration contient une valeur que le catalogue ne connaît pas.', 'ahime-joinery-configurator')];
            }
            $refus = [];
            foreach ($this->validate->valider($config) as $issue) {
                if ($issue['severite'] === 'erreur') {
                    $refus[] = (string) $issue['message'];
                }
            }
            if ($refus !== []) {
                return $refus;
            }
            $this->pricing->calculer($config);
        } catch (Throwable $erreur) {
            // Une configuration que le moteur ne sait pas lire n'entre pas au
            // panier : on ne fabrique pas sur ce qu'on ne comprend pas.
            return [__('Cette configuration n’a pas pu être vérifiée. Reprenez-la depuis le configurateur.', 'ahime-joinery-configurator')];
        }
        return [];
    }

    /**
     * LE REFUS, AVANT L'AJOUT.
     *
     * Le moteur chiffrait une configuration que le widget avait déclarée
     * infabricable, et l'encaissait. Un refus côté navigateur est un conseil ;
     * seul celui-ci empêche une commande de partir à l'atelier.
     *
     * @param bool $passe
     * @return bool
     */
    public function refuser_l_infabricable($passe, int $product_id)
    {
        $this->acceptee = null;
        // Un ajout au panier ordinaire (un produit sans configuration) n'est pas le nôtre.
        if (!isset($_POST['ahjc_configuration'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- présence seulement ; le jeton est vérifié juste après
            return $passe;
        }
        // LE JETON D'ABORD. Une configuration postée sans jeton valide (page restée
        // ouverte plus d'un jour, formulaire forgé) ne passe pas.
        $jeton = isset($_POST['ahjc_nonce']) ? sanitize_text_field(wp_unslash($_POST['ahjc_nonce'])) : '';
        if ($jeton === '' || !wp_verify_nonce($jeton, self::JETON)) {
            wc_add_notice(
                esc_html__('Cette page a expiré. Rechargez-la, puis ajoutez de nouveau votre configuration au panier.', 'ahime-joinery-configurator'),
                'error'
            );
            return false;
        }
        // LA LISTE BLANCHE. Le JSON est décodé, puis chaque champ est filtré par
        // son type dans AHJC_Configuration::lire() : clé connue, type, énumération,
        // bornes, texte passé par sanitize_text_field(). sanitize_textarea_field()
        // garde la forme du JSON (il ne retire que les balises et les octets
        // invalides) et borne ce qui arrive avant même le décodage.
        $json = sanitize_textarea_field(wp_unslash($_POST['ahjc_configuration']));
        try {
            $config = $this->liste_blanche->lire($json, array_keys((array) $this->catalogue->get('familles')));
        } catch (InvalidArgumentException $erreur) {
            wc_add_notice(
                esc_html__('Cette configuration n’est pas valide et n’a pas été ajoutée au panier. Reprenez-la depuis le configurateur.', 'ahime-joinery-configurator'),
                'error'
            );
            return false;
        }
        $motifs = $this->motifs_de_refus($config);
        if ($motifs !== []) {
            foreach ($motifs as $motif) {
                wc_add_notice(esc_html($motif), 'error');
            }
            return false;
        }
        $this->acceptee = $config;
        return $passe;
    }

    /**
     * L'AJOUT AU PANIER. Seule une configuration ACCEPTÉE par
     * `refuser_l_infabricable()` dans la même requête est rangée : déjà
     * filtrée, jamais relue telle que postée.
     *
     * @param array<string,mixed> $donnees
     * @return array<string,mixed>
     */
    public function attacher_la_configuration(array $donnees, int $product_id): array
    {
        if (!isset($_POST['ahjc_configuration'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- présence seulement ; la configuration acceptée a passé le jeton
            return $donnees;
        }
        if ($this->acceptee === null) {
            // Une configuration postée qui n'a pas passé les contrôles ne doit pas
            // faire entrer le produit nu, à son prix de catalogue : WooCommerce
            // rattrape l'exception et affiche le refus.
            throw new Exception(esc_html__('Cette configuration n’a pas pu être vérifiée. Reprenez-la depuis le configurateur.', 'ahime-joinery-configurator'));
        }
        $config = $this->acceptee;
        $donnees[self::CLE] = $config;
        // Le prix annoncé n'est qu'une indication, gardée pour être comparée.
        if (isset($_POST['ahjc_prix_annonce_cents'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- jeton vérifié par refuser_l_infabricable()
            $donnees[self::CLE_PRIX_ANNONCE] = absint(wp_unslash($_POST['ahjc_prix_annonce_cents'])); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- idem
        }
        // UNE CLÉ UNIQUE PAR CONFIGURATION, sans quoi WooCommerce fond deux
        // fenêtres différentes en une ligne de quantité deux parce qu'elles
        // portent le même produit. Deux menuiseries de cotes différentes ne
        // sont pas deux exemplaires : ce sont deux ouvrages.
        $donnees['unique_key'] = md5(wp_json_encode($config) . $product_id);
        $this->acceptee = null;
        return $donnees;
    }

    /**
     * LE RECALCUL, à chaque fois que WooCommerce totalise.
     *
     * Il est refait à CHAQUE passage et non mémorisé à l'ajout : une remise
     * quantité qui bascule quand le client passe de trois à quatre doit
     * basculer, et un tarif publié entre-temps doit s'appliquer.
     *
     * UNE LIGNE QUI NE SE CHIFFRE PLUS EST RETIRÉE. Elle restait au prix du
     * produit WooCommerce, qui est zéro sur un produit de configuration : un
     * changement de catalogue entre l'ajout et le paiement pouvait laisser
     * passer un ouvrage gratuit.
     */
    public function recalculer_le_panier(WC_Cart $panier): void
    {
        if (is_admin() && !defined('DOING_AJAX')) {
            return;
        }
        // Le garde-fou de WooCommerce contre le double calcul.
        if (did_action('woocommerce_before_calculate_totals') >= 2) {
            return;
        }
        foreach ($panier->get_cart() as $cle => $ligne) {
            if (empty($ligne[self::CLE]) || !isset($ligne['data'])) {
                continue;
            }
            $prix = null;
            if (is_array($ligne[self::CLE])) {
                $config = $ligne[self::CLE];
                // La QUANTITÉ du panier entre dans le calcul : c'est elle qui ouvre la remise.
                $config['quantite'] = max(1, (int) $ligne['quantity']);
                if ($this->motifs_de_refus($config) === []) {
                    try {
                        $prix = $this->pricing->calculer($config);
                    } catch (Throwable $erreur) {
                        $prix = null;
                    }
                }
            }
            if ($prix === null) {
                $panier->remove_cart_item($cle);
                wc_add_notice(
                    esc_html__('Un ouvrage de votre panier ne correspond plus au catalogue et a été retiré. Configurez-le de nouveau.', 'ahime-joinery-configurator'),
                    'error'
                );
                continue;
            }
            // LE PRIX AFFICHÉ, pas le total exact : c'est celui que le client a lu.
            // `$ligne['data']` est un OBJET : l'écriture porte sur le panier lui-même.
            $ligne['data']->set_price($prix['displayTotalCents'] / 100);
        }
    }

    /**
     * CE QUE LE CLIENT LIT DANS SON PANIER — et l'écart, s'il y en a un.
     *
     * L'écart n'est pas caché : un tarif qui a changé pendant que le client
     * remplissait son panier est une nouvelle qu'il doit apprendre AVANT de
     * payer, pas sur sa facture.
     *
     * @param array<int,array<string,string>> $donnees
     * @param array<string,mixed> $ligne
     * @return array<int,array<string,string>>
     */
    public function afficher_la_configuration(array $donnees, array $ligne): array
    {
        if (empty($ligne[self::CLE]) || !is_array($ligne[self::CLE])) {
            return $donnees;
        }
        $config = $ligne[self::CLE];
        $fam = $this->catalogue->get('familles')[$config['famille']] ?? null;
        $donnees[] = [
            'key' => esc_html__('Ouvrage', 'ahime-joinery-configurator'),
            'value' => esc_html(sprintf(
                '%s %d × %d mm',
                $fam['label'] ?? $config['famille'],
                (int) $config['widthMm'],
                (int) $config['heightMm']
            )),
        ];

        $annonce = $ligne[self::CLE_PRIX_ANNONCE] ?? null;
        if ($annonce !== null) {
            try {
                $prix = $this->pricing->calculer(
                    array_merge($config, ['quantite' => max(1, (int) ($ligne['quantity'] ?? 1))])
                );
            } catch (Throwable $erreur) {
                return $donnees;
            }
            $recalcule = $prix['displayTotalCents'];
            // LE WIDGET ANNONCE LE TOTAL BRUT (totalCents), le panier encaisse le
            // total arrondi (arrondi commercial). On compare le brut au brut.
            if ((int) $annonce !== (int) ($prix['totalCents'] ?? $recalcule) && (int) $annonce !== $recalcule) {
                // `wc_price()` rend du HTML : il va dans `display` (filtré par
                // wp_kses_post), pas dans `value`, que WooCommerce échappe.
                $phrase = sprintf(
                    /* translators: 1: prix annoncé, 2: prix recalculé */
                    esc_html__('Affiché %1$s au moment de la configuration, %2$s au tarif du jour.', 'ahime-joinery-configurator'),
                    wc_price($annonce / 100),
                    wc_price($recalcule / 100)
                );
                $donnees[] = [
                    'key' => esc_html__('Tarif mis à jour', 'ahime-joinery-configurator'),
                    'value' => wp_strip_all_tags($phrase),
                    'display' => wp_kses_post($phrase),
                ];
            }
        }
        return $donnees;
    }

    /**
     * LA COMMANDE PORTE LA CONFIGURATION ENTIÈRE — filtrée, et figée avec sa
     * version de catalogue : un prix se relit trois ans plus tard, en litige,
     * et « le tarif de l'époque » doit être retrouvable.
     *
     * @param array<string,mixed> $valeurs
     */
    public function figer_dans_la_commande(
        WC_Order_Item_Product $item,
        string $cle,
        array $valeurs,
        WC_Order $commande
    ): void {
        if (empty($valeurs[self::CLE]) || !is_array($valeurs[self::CLE])) {
            return;
        }
        $item->add_meta_data(self::CLE, wp_json_encode($valeurs[self::CLE]), true);
        $item->add_meta_data('_ahjc_catalogue_version', $this->catalogue->version(), true);
    }
}
