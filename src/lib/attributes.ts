/**
 * Les 8 attributs d'ASCEND — table de référence côté code.
 * Règle de design (PRD §5.1) : 8 attributs max, jamais plus.
 */

export const ATTRIBUTE_CODES = [
  "STR",
  "VIT",
  "INT",
  "DIS",
  "SOC",
  "CRE",
  "FIN",
  "ZEN",
] as const;

export type AttributeCode = (typeof ATTRIBUTE_CODES)[number];

export interface AttributeDef {
  code: AttributeCode;
  name: string;
  domain: string;
  color: string;
  icon: string;
}

export const ATTRIBUTES: Record<AttributeCode, AttributeDef> = {
  STR: {
    code: "STR",
    name: "Force",
    domain: "Sport, performance physique",
    color: "#F87171",
    icon: "dumbbell",
  },
  VIT: {
    code: "VIT",
    name: "Vitalité",
    domain: "Sommeil, santé, énergie",
    color: "#34D399",
    icon: "heart-pulse",
  },
  INT: {
    code: "INT",
    name: "Intellect",
    domain: "Apprentissage, savoir",
    color: "#60A5FA",
    icon: "brain",
  },
  DIS: {
    code: "DIS",
    name: "Discipline",
    domain: "Constance, habitudes",
    color: "#FB923C",
    icon: "target",
  },
  SOC: {
    code: "SOC",
    name: "Social",
    domain: "Relations, liens",
    color: "#F472B6",
    icon: "users",
  },
  CRE: {
    code: "CRE",
    name: "Création",
    domain: "Projets, art, build",
    color: "#C084FC",
    icon: "hammer",
  },
  FIN: {
    code: "FIN",
    name: "Fortune",
    domain: "Finances, patrimoine",
    color: "#FACC15",
    icon: "coins",
  },
  ZEN: {
    code: "ZEN",
    name: "Sérénité",
    domain: "Mental, calme",
    color: "#2DD4BF",
    icon: "leaf",
  },
};

export const ATTRIBUTE_LIST: AttributeDef[] = ATTRIBUTE_CODES.map(
  (code) => ATTRIBUTES[code],
);
