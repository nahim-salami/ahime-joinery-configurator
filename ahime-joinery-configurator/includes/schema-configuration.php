<?php
/**
 * LA LISTE BLANCHE DE LA CONFIGURATION, dérivée du type `JoineryConfiguration`.
 *
 * Generated from the JoineryConfiguration type (packages/core/src/types.ts): do not edit by hand.
 * Read by the cart before anything else.
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

return [
    'type' => 'objet',
    'champs' => [
        'famille' => [
            'type' => 'enum',
            'valeurs' => ['bso', 'coulissant', 'fenetre', 'fenetre-toit', 'moustiquaire', 'porte-entree', 'porte-fenetre', 'porte-garage', 'screen-zip', 'store-banne', 'store-interieur', 'volet-battant', 'volet-roulant'],
        ],
        'widthMm' => [
            'type' => 'nombre',
            'min' => 1,
            'max' => 100000,
        ],
        'heightMm' => [
            'type' => 'nombre',
            'min' => 1,
            'max' => 100000,
        ],
        'vantaux' => [
            'type' => 'nombre',
            'min' => 1,
            'max' => 12,
            'entier' => true,
        ],
        'ouverture' => [
            'type' => 'enum',
            'valeurs' => ['coulissant', 'fixe', 'frappe', 'galandage', 'levage', 'soufflet'],
        ],
        'ouvertureDeclaree' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'forme' => [
            'type' => 'enum',
            'valeurs' => ['anse-de-panier', 'chapeau-de-gendarme', 'chevron', 'concave', 'ovale', 'plein-cintre', 'rectangle', 'rond', 'surbaisse', 'trapeze', 'triangle'],
        ],
        'flecheMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'formeCoteBas' => [
            'type' => 'enum',
            'valeurs' => ['droite', 'gauche'],
        ],
        'sens' => [
            'type' => 'enum',
            'valeurs' => ['droite', 'gauche'],
        ],
        'materiau' => [
            'type' => 'enum',
            'valeurs' => ['alu', 'bois', 'mixte', 'pvc'],
        ],
        'gamme' => [
            'type' => 'enum',
            'valeurs' => ['confort', 'performance', 'standard'],
        ],
        'systeme' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'vitrage' => [
            'type' => 'objet',
            'champs' => [
                'base' => [
                    'type' => 'enum',
                    'valeurs' => ['double', 'double-itr', 'triple'],
                ],
                'phonique' => [
                    'type' => 'booleen',
                ],
                'feuillete' => [
                    'type' => 'booleen',
                ],
                'aspect' => [
                    'type' => 'enum',
                    'valeurs' => ['clair', 'depoli', 'sable', 'serigraphie'],
                ],
                'storeIntegre' => [
                    'type' => 'booleen',
                ],
                'warmEdge' => [
                    'type' => 'booleen',
                ],
                'controleSolaire' => [
                    'type' => 'booleen',
                ],
            ],
            'requis' => ['base'],
        ],
        'couleur' => [
            'type' => 'enum',
            'valeurs' => ['bicolore', 'blanc', 'plaxe', 'ral-1-face'],
        ],
        'ralExterieur' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'ralInterieur' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'decorPlaxe' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'finition' => [
            'type' => 'enum',
            'valeurs' => ['brillant', 'mat', 'satine', 'texture'],
        ],
        'remplissagePorte' => [
            'type' => 'enum',
            'valeurs' => ['pleine', 'semi-vitree', 'vitree'],
        ],
        'modelePorte' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'modeleVolet' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'remplissagePortail' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'refoulementMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'motorisation' => [
            'type' => 'objet',
            'champs' => [
                'type' => [
                    'type' => 'enum',
                    'valeurs' => ['bras', 'cremaillere', 'enterre', 'roue', 'verin'],
                ],
                'alimentation' => [
                    'type' => 'enum',
                    'valeurs' => ['filaire', 'solaire'],
                ],
                'securites' => [
                    'type' => 'liste',
                    'element' => [
                        'type' => 'enum',
                        'valeurs' => ['barre-palpeuse', 'cellules', 'deverrouillage-manuel', 'feu-orange', 'limiteur-effort'],
                    ],
                    'max' => 100,
                ],
            ],
            'requis' => ['type', 'alimentation'],
        ],
        'usage' => [
            'type' => 'enum',
            'valeurs' => ['prive', 'public'],
        ],
        'stationnementPrecaire' => [
            'type' => 'booleen',
        ],
        'remplissageCloture' => [
            'type' => 'enum',
            'valeurs' => ['grillage-souple', 'lames', 'panneau-rigide'],
        ],
        'occultation' => [
            'type' => 'booleen',
        ],
        'remplissageGardeCorps' => [
            'type' => 'enum',
            'valeurs' => ['barreaux', 'cables', 'tole-perforee', 'verre'],
        ],
        'compositionVerreGardeCorps' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'fixationGardeCorps' => [
            'type' => 'enum',
            'valeurs' => ['anglaise', 'francaise'],
        ],
        'typeStoreInterieur' => [
            'type' => 'enum',
            'valeurs' => ['californien', 'enrouleur', 'plisse', 'venitien'],
        ],
        'toileStore' => [
            'type' => 'enum',
            'valeurs' => ['occultant', 'screen', 'tamisant'],
        ],
        'lameStoreMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'modeleBso' => [
            'type' => 'enum',
            'valeurs' => ['lamisol-70', 'lamisol-90', 'lamisol-vento'],
        ],
        'linteauDisponibleMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'toileScreen' => [
            'type' => 'enum',
            'valeurs' => ['soltis-92'],
        ],
        'teinteToile' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'guidageDeToile' => [
            'type' => 'enum',
            'valeurs' => ['cables', 'zip'],
        ],
        'implantationPortail' => [
            'type' => 'enum',
            'valeurs' => ['en-tableau', 'entre-piliers'],
        ],
        'epaisseurPanneauMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'profondeurMeubleMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'etageres' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'montantsIntermediaires' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'facadeCaisson' => [
            'type' => 'enum',
            'valeurs' => ['battante', 'coulissante', 'ouvert'],
        ],
        'vantauxFacade' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'decorSansFil' => [
            'type' => 'booleen',
        ],
        'hauteurDePiedMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'retraitDuPiedMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'debordDuPlateauMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'colonnesDeTiroirsDuBuffet' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'partDeNicheEnMilliemes' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'usageEnfant' => [
            'type' => 'booleen',
        ],
        'ameDeVantail' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'epaisseurDeCloisonMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'chassisDeGalandageMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'recouvrementDeVantailMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'murDisponibleMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'compositionDeVerre' => [
            'type' => 'texte',
            'max' => 200,
        ],
        'vitrageAccessible' => [
            'type' => 'booleen',
        ],
        'releveDeNiche' => [
            'type' => 'objet',
            'champs' => [
                'largeursMm' => [
                    'type' => 'liste',
                    'element' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'min' => 3,
                    'max' => 3,
                ],
                'hauteursMm' => [
                    'type' => 'liste',
                    'element' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'min' => 3,
                    'max' => 3,
                ],
                'profondeursMm' => [
                    'type' => 'liste',
                    'element' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'min' => 3,
                    'max' => 3,
                ],
                'denivelleeSolMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'rampant' => [
                    'type' => 'objet',
                    'champs' => [
                        'hauteurBasseMm' => [
                            'type' => 'nombre',
                            'min' => -1000000,
                            'max' => 1000000,
                        ],
                        'angleDeg' => [
                            'type' => 'nombre',
                            'min' => -1000000,
                            'max' => 1000000,
                        ],
                        'monteVers' => [
                            'type' => 'enum',
                            'valeurs' => ['droite', 'fond', 'gauche'],
                        ],
                    ],
                    'requis' => ['hauteurBasseMm', 'angleDeg', 'monteVers'],
                ],
            ],
            'requis' => ['largeursMm', 'hauteursMm', 'profondeursMm'],
        ],
        'chargeEtagereKgParM' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'gtotDemande' => [
            'type' => 'booleen',
        ],
        'typeMoustiquaire' => [
            'type' => 'enum',
            'valeurs' => ['cadre-fixe', 'coulissante', 'enroulable-laterale', 'enroulable-verticale', 'plissee'],
        ],
        'ouvrantProtegeSort' => [
            'type' => 'booleen',
        ],
        'remplissageToiture' => [
            'type' => 'enum',
            'valeurs' => ['polycarbonate', 'sandwich', 'vitrage'],
        ],
        'zoneNeige' => [
            'type' => 'enum',
            'valeurs' => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E'],
        ],
        'altitudeM' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'formatModulePv' => [
            'type' => 'enum',
            'valeurs' => ['module-courant', 'module-grand-format'],
        ],
        'retraitDeRiveMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'puissanceOnduleurW' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'borneDeRecharge' => [
            'type' => 'booleen',
        ],
        'batterieStockage' => [
            'type' => 'booleen',
        ],
        'hauteurPassageMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'entraxeChevronsMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'sectionChevronMm' => [
            'type' => 'objet',
            'champs' => [
                'largeurMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'hauteurMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
            ],
            'requis' => ['largeurMm', 'hauteurMm'],
        ],
        'azimutPanDeg' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'obstaclesToiture' => [
            'type' => 'liste',
            'element' => [
                'type' => 'objet',
                'champs' => [
                    'nom' => [
                        'type' => 'texte',
                        'max' => 200,
                    ],
                    'xMm' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'yMm' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'largeurMm' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                    'hauteurMm' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                ],
                'requis' => ['nom', 'xMm', 'yMm', 'largeurMm', 'hauteurMm'],
            ],
            'max' => 100,
        ],
        'opaciteModuleMilliemes' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'adossee' => [
            'type' => 'booleen',
        ],
        'commandeLames' => [
            'type' => 'enum',
            'valeurs' => ['electrique', 'manuelle'],
        ],
        'lameVoletMm' => [
            'type' => 'enum',
            'valeurs' => [37, 41, 55],
        ],
        'coteManoeuvre' => [
            'type' => 'enum',
            'valeurs' => ['droite', 'gauche'],
        ],
        'sensOuvertureLames' => [
            'type' => 'enum',
            'valeurs' => ['arriere', 'avant'],
        ],
        'penteToitureDeg' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'couverture' => [
            'type' => 'enum',
            'valeurs' => ['ardoises', 'bac-acier', 'tuiles'],
        ],
        'retombeeLinteauMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'ecoinconMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'profondeurGarageMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'zoneVent' => [
            'type' => 'enum',
            'valeurs' => ['abritee', 'exposee', 'normale'],
        ],
        'terrain' => [
            'type' => 'objet',
            'champs' => [
                'troncons' => [
                    'type' => 'liste',
                    'element' => [
                        'type' => 'objet',
                        'champs' => [
                            'longueurMm' => [
                                'type' => 'nombre',
                                'min' => -1000000,
                                'max' => 1000000,
                            ],
                            'angleDeg' => [
                                'type' => 'nombre',
                                'min' => -1000000,
                                'max' => 1000000,
                            ],
                            'ouverture' => [
                                'type' => 'objet',
                                'champs' => [
                                    'largeurMm' => [
                                        'type' => 'nombre',
                                        'min' => -1000000,
                                        'max' => 1000000,
                                    ],
                                    'label' => [
                                        'type' => 'texte',
                                        'max' => 200,
                                    ],
                                    'depuisDebutMm' => [
                                        'type' => 'nombre',
                                        'min' => -1000000,
                                        'max' => 1000000,
                                    ],
                                ],
                                'requis' => ['largeurMm', 'label'],
                            ],
                        ],
                        'requis' => ['longueurMm'],
                    ],
                    'max' => 100,
                ],
            ],
            'requis' => ['troncons'],
        ],
        'sensRefoulement' => [
            'type' => 'enum',
            'valeurs' => ['droite', 'gauche'],
        ],
        'coffre' => [
            'type' => 'enum',
            'valeurs' => ['bloc-baie', 'exterieur', 'tunnel'],
        ],
        'manoeuvre' => [
            'type' => 'enum',
            'valeurs' => ['manivelle', 'sangle'],
        ],
        'pose' => [
            'type' => 'enum',
            'valeurs' => ['applique', 'depose-totale', 'neuf-tableau', 'renovation'],
        ],
        'tapeeMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'hauteurAllegeMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'facade' => [
            'type' => 'objet',
            'champs' => [
                'largeurMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'hauteurEgoutMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'hauteurFaitageMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'toiture' => [
                    'type' => 'enum',
                    'valeurs' => ['gouttiere', 'monopente', 'pignon', 'terrasse'],
                ],
                'implantationXMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'debordToitureMm' => [
                    'type' => 'nombre',
                    'min' => -1000000,
                    'max' => 1000000,
                ],
                'orientation' => [
                    'type' => 'enum',
                    'valeurs' => ['est', 'nord', 'ouest', 'sud'],
                ],
            ],
            'requis' => ['largeurMm', 'hauteurEgoutMm', 'toiture'],
        ],
        'imposteHauteurMm' => [
            'type' => 'nombre',
            'min' => -1000000,
            'max' => 1000000,
        ],
        'options' => [
            'type' => 'liste',
            'element' => [
                'type' => 'objet',
                'champs' => [
                    'id' => [
                        'type' => 'enum',
                        'valeurs' => ['bloc-baie-manuel', 'boite-aux-lettres', 'capteur-vent', 'clavier-code', 'gache-electrique', 'garage-ferrure-reduite', 'garage-panneau-isole', 'grille-croisillons', 'grille-defense', 'grille-horizontale', 'grille-ouvragee', 'grille-ventilation', 'heurtoir', 'interphone', 'judas', 'lecteur-badge', 'motorisation-filaire', 'motorisation-radio', 'motorisation-solaire', 'moustiquaire', 'oscillo-battant', 'petits-bois', 'poignee-cle', 'serrure-a2p', 'seuil-pmr', 'soubassement-inox', 'telecommande', 'tiroir-sortie-totale', 'verrou-automatique', 'visiophone'],
                    ],
                    'quantite' => [
                        'type' => 'nombre',
                        'min' => 1,
                        'max' => 9999,
                        'entier' => true,
                    ],
                ],
                'requis' => ['id'],
            ],
            'max' => 100,
        ],
        'postes' => [
            'type' => 'liste',
            'element' => [
                'type' => 'objet',
                'champs' => [
                    'id' => [
                        'type' => 'texte',
                        'max' => 200,
                    ],
                    'quantiteMilliemes' => [
                        'type' => 'nombre',
                        'min' => -1000000,
                        'max' => 1000000,
                    ],
                ],
                'requis' => ['id'],
            ],
            'max' => 100,
        ],
        'compositionPetitsBois' => [
            'type' => 'enum',
            'valeurs' => ['droits', 'imperiale', 'losanges'],
        ],
        'exposition' => [
            'type' => 'objet',
            'champs' => [
                'zoneVent' => [
                    'type' => 'enum',
                    'valeurs' => [1, 2, 3, 4],
                ],
                'etageEleve' => [
                    'type' => 'booleen',
                ],
            ],
            'requis' => ['zoneVent', 'etageEleve'],
        ],
        'quantite' => [
            'type' => 'nombre',
            'min' => 1,
            'max' => 9999,
            'entier' => true,
        ],
    ],
    'requis' => ['famille', 'widthMm', 'heightMm', 'vantaux', 'materiau', 'gamme', 'couleur'],
];
