export interface SeedReward {
  name: string;
  description: string;
  pointsCost: number;
  category: string;
  value: number;
}

export const DEFAULT_LOYALTY_REWARDS: SeedReward[] = [
  {
    name: "Reduction 5%",
    description: "5% de reduction sur votre prochaine commande",
    pointsCost: 200,
    category: "discount",
    value: 5,
  },
  {
    name: "Reduction 10%",
    description: "10% de reduction sur votre prochaine commande",
    pointsCost: 500,
    category: "discount",
    value: 10,
  },
  {
    name: "Livraison gratuite",
    description: "Livraison offerte sur votre prochaine commande",
    pointsCost: 300,
    category: "delivery",
    value: 5000,
  },
  {
    name: "Boisson offerte",
    description: "Une boisson gratuite avec votre commande",
    pointsCost: 150,
    category: "free_item",
    value: 5000,
  },
  {
    name: "Dessert offert",
    description: "Un dessert gratuit avec votre repas",
    pointsCost: 400,
    category: "free_item",
    value: 15000,
  },
  {
    name: "Reduction VIP 20%",
    description: "20% de reduction - exclusif membres Gold+",
    pointsCost: 1000,
    category: "special",
    value: 20,
  },
];

export const DEFAULT_LOYALTY_HISTORY: {
  customerEmail: string;
  points: number;
  type: string;
  description: string;
  referenceId: string;
  daysAgo: number;
}[] = [
  {
    customerEmail: "aminata@gmail.com",
    points: 50,
    type: "earned",
    description: "Points de réservation",
    referenceId: "",
    daysAgo: 1,
  },
  {
    customerEmail: "aminata@gmail.com",
    points: 85,
    type: "earned",
    description: "Points de commande - Riz Jollof KFM Spécial",
    referenceId: "",
    daysAgo: 3,
  },
  {
    customerEmail: "aminata@gmail.com",
    points: 25,
    type: "bonus",
    description: "Bonus avis client",
    referenceId: "",
    daysAgo: 5,
  },
  {
    customerEmail: "fatoumata@gmail.com",
    points: 115,
    type: "earned",
    description: "Points de commande - Agneau Braisé aux Épices",
    referenceId: "",
    daysAgo: 2,
  },
  {
    customerEmail: "fatoumata@gmail.com",
    points: 50,
    type: "earned",
    description: "Points de réservation",
    referenceId: "",
    daysAgo: 4,
  },
  {
    customerEmail: "fatoumata@gmail.com",
    points: -200,
    type: "redeemed",
    description: "Échange: Reduction 5%",
    referenceId: "",
    daysAgo: 7,
  },
  {
    customerEmail: "kadiatou@gmail.com",
    points: 189,
    type: "earned",
    description: "Points de commande - Plateau Fruits de Mer KFM",
    referenceId: "",
    daysAgo: 1,
  },
  {
    customerEmail: "kadiatou@gmail.com",
    points: 50,
    type: "bonus",
    description: "Bonus fidélité mensuel",
    referenceId: "",
    daysAgo: 10,
  },
  {
    customerEmail: "mamadou@gmail.com",
    points: 42,
    type: "earned",
    description: "Points de commande - Plasas Traditionnel",
    referenceId: "",
    daysAgo: 6,
  },
  {
    customerEmail: "ibrahim@gmail.com",
    points: 50,
    type: "earned",
    description: "Points de réservation",
    referenceId: "",
    daysAgo: 2,
  },
];
