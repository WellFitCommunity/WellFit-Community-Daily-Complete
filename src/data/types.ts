// src/data/types.ts

export type Recipe = {
  id?: string | number;
  name: string;
  description?: string;
  images?: string[];
  image_url?: string;
  steps?: string[];
  calories?: number | null;
  cost?: number | null;
  ingredients?: string[];
  cook_time?: string;
  cook_temp?: string;
  tags?: string;
};
