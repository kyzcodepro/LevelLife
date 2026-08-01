/**
 * Données de seed : 60 types d'activité système répartis sur les 8 attributs.
 * base_xp calibré : ~15 (micro-action) à ~60 (session majeure).
 */

import type { AttributeCode } from "@/lib/attributes";

export interface SeedActivityType {
  code: string;
  label: string;
  attributeCode: AttributeCode;
  secondaryAttributeCode?: AttributeCode;
  baseXp: number;
  icon: string;
}

export const SYSTEM_ACTIVITY_TYPES: SeedActivityType[] = [
  // --- STR — Force -------------------------------------------------------
  { code: "str_muscu", label: "Musculation", attributeCode: "STR", baseXp: 45, icon: "dumbbell" },
  { code: "str_course", label: "Course à pied", attributeCode: "STR", secondaryAttributeCode: "VIT", baseXp: 40, icon: "footprints" },
  { code: "str_velo", label: "Vélo", attributeCode: "STR", secondaryAttributeCode: "VIT", baseXp: 35, icon: "bike" },
  { code: "str_natation", label: "Natation", attributeCode: "STR", baseXp: 45, icon: "waves" },
  { code: "str_sport_co", label: "Sport collectif", attributeCode: "STR", secondaryAttributeCode: "SOC", baseXp: 45, icon: "trophy" },
  { code: "str_arts_martiaux", label: "Arts martiaux / boxe", attributeCode: "STR", baseXp: 50, icon: "swords" },
  { code: "str_escalade", label: "Escalade", attributeCode: "STR", baseXp: 45, icon: "mountain" },
  { code: "str_marche", label: "Marche active (8k+ pas)", attributeCode: "STR", secondaryAttributeCode: "VIT", baseXp: 20, icon: "footprints" },
  { code: "str_mobilite", label: "Mobilité / étirements", attributeCode: "STR", secondaryAttributeCode: "ZEN", baseXp: 15, icon: "stretch-horizontal" },

  // --- VIT — Vitalité ----------------------------------------------------
  { code: "vit_sommeil", label: "Nuit de 7 h+", attributeCode: "VIT", baseXp: 25, icon: "moon" },
  { code: "vit_coucher_tot", label: "Couché avant 23 h", attributeCode: "VIT", secondaryAttributeCode: "DIS", baseXp: 15, icon: "bed" },
  { code: "vit_repas_sain", label: "Repas équilibré maison", attributeCode: "VIT", baseXp: 15, icon: "salad" },
  { code: "vit_hydratation", label: "2 L d'eau", attributeCode: "VIT", baseXp: 10, icon: "glass-water" },
  { code: "vit_checkup", label: "RDV médical / checkup", attributeCode: "VIT", baseXp: 40, icon: "stethoscope" },
  { code: "vit_sans_alcool", label: "Journée sans alcool", attributeCode: "VIT", secondaryAttributeCode: "DIS", baseXp: 15, icon: "cup-soda" },
  { code: "vit_sieste", label: "Sieste réparatrice", attributeCode: "VIT", baseXp: 10, icon: "alarm-clock" },

  // --- INT — Intellect ---------------------------------------------------
  { code: "int_lecture", label: "Lecture", attributeCode: "INT", baseXp: 30, icon: "book-open" },
  { code: "int_cours", label: "Cours / formation en ligne", attributeCode: "INT", baseXp: 40, icon: "graduation-cap" },
  { code: "int_langue", label: "Pratique d'une langue", attributeCode: "INT", baseXp: 25, icon: "languages" },
  { code: "int_podcast", label: "Podcast / documentaire", attributeCode: "INT", baseXp: 15, icon: "podcast" },
  { code: "int_article", label: "Article de fond / veille", attributeCode: "INT", baseXp: 15, icon: "newspaper" },
  { code: "int_certif", label: "Examen / certification", attributeCode: "INT", baseXp: 60, icon: "badge-check" },
  { code: "int_echecs", label: "Jeu de réflexion (échecs…)", attributeCode: "INT", baseXp: 20, icon: "puzzle" },
  { code: "int_notes", label: "Synthèse / prise de notes", attributeCode: "INT", secondaryAttributeCode: "CRE", baseXp: 20, icon: "notebook-pen" },

  // --- DIS — Discipline --------------------------------------------------
  { code: "dis_reveil", label: "Réveil à l'heure prévue", attributeCode: "DIS", baseXp: 15, icon: "alarm-clock-check" },
  { code: "dis_todo", label: "To-do list du jour terminée", attributeCode: "DIS", baseXp: 30, icon: "list-checks" },
  { code: "dis_deep_work", label: "Session deep work", attributeCode: "DIS", secondaryAttributeCode: "CRE", baseXp: 40, icon: "timer" },
  { code: "dis_rangement", label: "Rangement / ménage", attributeCode: "DIS", baseXp: 15, icon: "brush-cleaning" },
  { code: "dis_planif", label: "Planification de la semaine", attributeCode: "DIS", baseXp: 20, icon: "calendar-check" },
  { code: "dis_sans_reseaux", label: "Journée sans réseaux sociaux", attributeCode: "DIS", secondaryAttributeCode: "ZEN", baseXp: 25, icon: "smartphone-off" },
  { code: "dis_corvee", label: "Tâche repoussée enfin faite", attributeCode: "DIS", baseXp: 25, icon: "check-check" },

  // --- SOC — Social ------------------------------------------------------
  { code: "soc_appel_famille", label: "Appel famille", attributeCode: "SOC", baseXp: 20, icon: "phone" },
  { code: "soc_soiree", label: "Soirée entre amis", attributeCode: "SOC", baseXp: 30, icon: "party-popper" },
  { code: "soc_rencontre", label: "Nouvelle rencontre", attributeCode: "SOC", baseXp: 40, icon: "user-plus" },
  { code: "soc_repas_partage", label: "Repas partagé", attributeCode: "SOC", baseXp: 20, icon: "utensils" },
  { code: "soc_aide", label: "Coup de main / service rendu", attributeCode: "SOC", baseXp: 30, icon: "hand-heart" },
  { code: "soc_benevolat", label: "Bénévolat", attributeCode: "SOC", secondaryAttributeCode: "ZEN", baseXp: 50, icon: "heart-handshake" },
  { code: "soc_date", label: "Date / moment en couple", attributeCode: "SOC", baseXp: 30, icon: "heart" },
  { code: "soc_evenement", label: "Événement / meetup", attributeCode: "SOC", secondaryAttributeCode: "INT", baseXp: 35, icon: "users" },

  // --- CRE — Création ----------------------------------------------------
  { code: "cre_code", label: "Code / side-project", attributeCode: "CRE", baseXp: 40, icon: "code" },
  { code: "cre_ecriture", label: "Écriture", attributeCode: "CRE", baseXp: 35, icon: "pen-line" },
  { code: "cre_musique", label: "Musique (pratique/compo)", attributeCode: "CRE", baseXp: 35, icon: "music" },
  { code: "cre_dessin", label: "Dessin / peinture", attributeCode: "CRE", baseXp: 30, icon: "palette" },
  { code: "cre_photo_video", label: "Photo / vidéo / montage", attributeCode: "CRE", baseXp: 30, icon: "camera" },
  { code: "cre_bricolage", label: "Bricolage / DIY", attributeCode: "CRE", baseXp: 30, icon: "hammer" },
  { code: "cre_cuisine", label: "Nouvelle recette", attributeCode: "CRE", secondaryAttributeCode: "VIT", baseXp: 25, icon: "chef-hat" },
  { code: "cre_publication", label: "Publication (post, démo, release)", attributeCode: "CRE", baseXp: 50, icon: "rocket" },

  // --- FIN — Fortune -----------------------------------------------------
  { code: "fin_epargne", label: "Épargne du mois", attributeCode: "FIN", baseXp: 40, icon: "piggy-bank" },
  { code: "fin_budget", label: "Revue de budget", attributeCode: "FIN", secondaryAttributeCode: "DIS", baseXp: 25, icon: "wallet" },
  { code: "fin_invest", label: "Investissement", attributeCode: "FIN", baseXp: 35, icon: "trending-up" },
  { code: "fin_dette", label: "Remboursement de dette", attributeCode: "FIN", baseXp: 45, icon: "banknote" },
  { code: "fin_revenu", label: "Revenu additionnel", attributeCode: "FIN", secondaryAttributeCode: "CRE", baseXp: 50, icon: "coins" },
  { code: "fin_negociation", label: "Négociation (salaire, abonnement…)", attributeCode: "FIN", baseXp: 45, icon: "handshake" },
  { code: "fin_formation", label: "Éducation financière", attributeCode: "FIN", secondaryAttributeCode: "INT", baseXp: 20, icon: "book-open" },

  // --- ZEN — Sérénité ----------------------------------------------------
  { code: "zen_meditation", label: "Méditation", attributeCode: "ZEN", baseXp: 25, icon: "brain" },
  { code: "zen_nature", label: "Sortie nature", attributeCode: "ZEN", secondaryAttributeCode: "VIT", baseXp: 30, icon: "trees" },
  { code: "zen_journal", label: "Journaling", attributeCode: "ZEN", secondaryAttributeCode: "CRE", baseXp: 20, icon: "notebook" },
  { code: "zen_detox", label: "Digital detox", attributeCode: "ZEN", baseXp: 30, icon: "smartphone-off" },
  { code: "zen_therapie", label: "Thérapie / accompagnement", attributeCode: "ZEN", baseXp: 45, icon: "message-circle-heart" },
  { code: "zen_respiration", label: "Respiration / cohérence cardiaque", attributeCode: "ZEN", baseXp: 15, icon: "wind" },
  { code: "zen_gratitude", label: "3 gratitudes du jour", attributeCode: "ZEN", baseXp: 10, icon: "sparkles" },
];
