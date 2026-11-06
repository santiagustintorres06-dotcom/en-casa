export const categories = ['Almacén', 'Lácteos', 'Verdulería', 'Carnicería', 'Congelados', 'Bebidas', 'Limpieza', 'Higiene', 'Otros'] as const;
export const units = ['un', 'kg', 'g', 'l', 'ml', 'paquete'] as const;
export type Product = { id: string; name: string; category: typeof categories[number]; quantity: number; unit: typeof units[number]; minimumStock: number; updatedAt: string };
export type ProductInput = Omit<Product, 'id' | 'updatedAt'>;
