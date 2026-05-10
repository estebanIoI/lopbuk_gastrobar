import type { ProductType } from './types'

export interface ProductTypeConfig {
  id: ProductType
  name: string
  icon: string
  description: string
  color: string
  fields: string[]
}

export interface FieldDefinition {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea'
  required?: boolean
  placeholder?: string
  description?: string
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
  defaultValue?: any
}

export const PRODUCT_TYPES: Record<ProductType, ProductTypeConfig> = {
  general: {
    id: 'general',
    name: 'General',
    icon: '📦',
    description: 'Producto generico',
    color: 'gray',
    fields: ['brand', 'model', 'description', 'locationInStore', 'notes']
  },
  alimentos: {
    id: 'alimentos',
    name: 'Alimentos',
    icon: '🍎',
    description: 'Alimentos perecederos y no perecederos',
    color: 'green',
    fields: ['brand', 'expiryDate', 'batchNumber', 'netWeight', 'weightUnit', 'sanitaryRegistration', 'storageTemperature', 'ingredients', 'nutritionalInfo', 'allergens', 'locationInStore', 'notes']
  },
  bebidas: {
    id: 'bebidas',
    name: 'Bebidas',
    icon: '🥤',
    description: 'Bebidas con o sin alcohol',
    color: 'blue',
    fields: ['brand', 'expiryDate', 'batchNumber', 'netWeight', 'weightUnit', 'sanitaryRegistration', 'alcoholContent', 'ingredients', 'locationInStore', 'notes']
  },
  ropa: {
    id: 'ropa',
    name: 'Ropa y Textiles',
    icon: '👕',
    description: 'Prendas de vestir y textiles',
    color: 'purple',
    fields: ['brand', 'size', 'color', 'material', 'gender', 'season', 'garmentType', 'washingInstructions', 'countryOfOrigin', 'locationInStore', 'notes']
  },
  electronica: {
    id: 'electronica',
    name: 'Electronica',
    icon: '💻',
    description: 'Dispositivos electronicos y tecnologia',
    color: 'cyan',
    fields: ['brand', 'model', 'serialNumber', 'warrantyMonths', 'technicalSpecs', 'voltage', 'powerWatts', 'compatibility', 'includesAccessories', 'productCondition', 'locationInStore', 'notes']
  },
  farmacia: {
    id: 'farmacia',
    name: 'Farmacia y Salud',
    icon: '💊',
    description: 'Medicamentos y productos de salud',
    color: 'red',
    fields: ['activeIngredient', 'concentration', 'expiryDate', 'batchNumber', 'sanitaryRegistration', 'requiresPrescription', 'administrationRoute', 'presentation', 'unitsPerPackage', 'laboratory', 'contraindications', 'storageTemperature', 'locationInStore', 'notes']
  },
  ferreteria: {
    id: 'ferreteria',
    name: 'Ferreteria',
    icon: '🔧',
    description: 'Herramientas y materiales de construccion',
    color: 'orange',
    fields: ['brand', 'model', 'dimensions', 'weight', 'hardwareWeightUnit', 'material', 'caliber', 'resistance', 'finish', 'recommendedUse', 'warrantyMonths', 'locationInStore', 'notes']
  },
  libreria: {
    id: 'libreria',
    name: 'Libreria y Papeleria',
    icon: '📚',
    description: 'Libros, revistas y papeleria',
    color: 'yellow',
    fields: ['author', 'publisher', 'isbn', 'pages', 'language', 'publicationYear', 'edition', 'bookFormat', 'locationInStore', 'notes']
  },
  juguetes: {
    id: 'juguetes',
    name: 'Juguetes',
    icon: '🎮',
    description: 'Juguetes y entretenimiento',
    color: 'pink',
    fields: ['brand', 'recommendedAge', 'numberOfPlayers', 'gameType', 'requiresBatteries', 'packageDimensions', 'packageContents', 'safetyWarnings', 'locationInStore', 'notes']
  },
  cosmetica: {
    id: 'cosmetica',
    name: 'Cosmeticos',
    icon: '💄',
    description: 'Productos de belleza y cuidado personal',
    color: 'rose',
    fields: ['brand', 'expiryDate', 'batchNumber', 'netWeight', 'weightUnit', 'sanitaryRegistration', 'ingredients', 'locationInStore', 'notes']
  },
  deportes: {
    id: 'deportes',
    name: 'Deportes',
    icon: '⚽',
    description: 'Articulos deportivos y fitness',
    color: 'lime',
    fields: ['brand', 'model', 'size', 'color', 'material', 'warrantyMonths', 'recommendedUse', 'locationInStore', 'notes']
  },
  hogar: {
    id: 'hogar',
    name: 'Hogar',
    icon: '🏠',
    description: 'Articulos para el hogar',
    color: 'amber',
    fields: ['brand', 'model', 'dimensions', 'material', 'color', 'warrantyMonths', 'locationInStore', 'notes']
  },
  mascotas: {
    id: 'mascotas',
    name: 'Mascotas',
    icon: '🐕',
    description: 'Productos para mascotas',
    color: 'teal',
    fields: ['brand', 'expiryDate', 'batchNumber', 'netWeight', 'weightUnit', 'recommendedUse', 'locationInStore', 'notes']
  },
  perfumes: {
    id: 'perfumes',
    name: 'Perfumes',
    icon: '🧴',
    description: 'Perfumes y fragancias',
    color: 'violet',
    fields: ['brand', 'gender', 'netWeight', 'weightUnit', 'countryOfOrigin', 'description', 'locationInStore', 'notes']
  },
  otros: {
    id: 'otros',
    name: 'Otros',
    icon: '📋',
    description: 'Otros productos',
    color: 'slate',
    fields: ['brand', 'model', 'description', 'locationInStore', 'notes']
  }
}

export const FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  // Comunes
  brand: { name: 'brand', label: 'Marca', type: 'text', placeholder: 'Ej: Nike, Samsung, Coca-Cola' },
  model: { name: 'model', label: 'Modelo', type: 'text', placeholder: 'Modelo o referencia' },
  description: { name: 'description', label: 'Descripcion', type: 'textarea', placeholder: 'Descripcion del producto' },
  locationInStore: { name: 'locationInStore', label: 'Ubicacion en Tienda', type: 'text', placeholder: 'Ej: Estante A1, Refrigerador 2' },
  notes: { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Notas adicionales' },
  // Alimentos / Bebidas
  expiryDate: { name: 'expiryDate', label: 'Fecha de Vencimiento', type: 'date', description: 'Fecha de caducidad' },
  batchNumber: { name: 'batchNumber', label: 'Numero de Lote', type: 'text', placeholder: 'Ej: L123456' },
  netWeight: { name: 'netWeight', label: 'Peso/Contenido Neto', type: 'number', min: 0, step: 0.01, placeholder: '500' },
  weightUnit: {
    name: 'weightUnit', label: 'Unidad de Medida', type: 'select',
    options: [
      { value: 'g', label: 'Gramos (g)' }, { value: 'kg', label: 'Kilogramos (kg)' },
      { value: 'ml', label: 'Mililitros (ml)' }, { value: 'l', label: 'Litros (l)' },
      { value: 'oz', label: 'Onzas (oz)' }, { value: 'lb', label: 'Libras (lb)' },
      { value: 'unidad', label: 'Unidad' }
    ]
  },
  sanitaryRegistration: { name: 'sanitaryRegistration', label: 'Registro Sanitario/INVIMA', type: 'text', placeholder: 'Ej: RSA-0012345' },
  storageTemperature: { name: 'storageTemperature', label: 'Temperatura de Almacenamiento', type: 'text', placeholder: 'Ej: 2-8°C, Ambiente' },
  ingredients: { name: 'ingredients', label: 'Ingredientes', type: 'textarea', placeholder: 'Lista de ingredientes' },
  nutritionalInfo: { name: 'nutritionalInfo', label: 'Info Nutricional', type: 'textarea', placeholder: 'Calorias, proteinas, etc.' },
  alcoholContent: { name: 'alcoholContent', label: 'Grado Alcoholico (%)', type: 'number', min: 0, max: 100, step: 0.1, placeholder: '5.0' },
  allergens: { name: 'allergens', label: 'Alergenos', type: 'textarea', placeholder: 'Ej: Contiene gluten, lacteos' },
  // Ropa
  size: {
    name: 'size', label: 'Talla', type: 'select',
    options: [
      { value: 'XS', label: 'XS' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' },
      { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }, { value: 'XXL', label: 'XXL' }, { value: 'XXXL', label: 'XXXL' }
    ]
  },
  color: { name: 'color', label: 'Color', type: 'text', placeholder: 'Ej: Azul, Rojo, Negro' },
  material: { name: 'material', label: 'Material', type: 'text', placeholder: 'Ej: 100% Algodon' },
  gender: {
    name: 'gender', label: 'Genero', type: 'select',
    options: [
      { value: 'hombre', label: 'Hombre' }, { value: 'mujer', label: 'Mujer' },
      { value: 'unisex', label: 'Unisex' }, { value: 'niño', label: 'Niño' }, { value: 'niña', label: 'Niña' }
    ]
  },
  season: {
    name: 'season', label: 'Temporada', type: 'select',
    options: [
      { value: 'verano', label: 'Verano' }, { value: 'invierno', label: 'Invierno' },
      { value: 'primavera', label: 'Primavera' }, { value: 'otoño', label: 'Otoño' }, { value: 'todo_año', label: 'Todo el año' }
    ]
  },
  garmentType: { name: 'garmentType', label: 'Tipo de Prenda', type: 'text', placeholder: 'Ej: Camisa, Pantalon' },
  washingInstructions: { name: 'washingInstructions', label: 'Instrucciones de Lavado', type: 'textarea', placeholder: 'Ej: Lavar a maquina 30°C' },
  countryOfOrigin: { name: 'countryOfOrigin', label: 'Pais de Origen', type: 'text', placeholder: 'Ej: Colombia, China' },
  // Electronica
  serialNumber: { name: 'serialNumber', label: 'Numero de Serie', type: 'text', placeholder: 'Numero de serie o IMEI' },
  warrantyMonths: { name: 'warrantyMonths', label: 'Garantia (meses)', type: 'number', min: 0, max: 120, placeholder: '12' },
  technicalSpecs: { name: 'technicalSpecs', label: 'Especificaciones Tecnicas', type: 'textarea', placeholder: 'RAM, procesador, etc.' },
  voltage: { name: 'voltage', label: 'Voltaje', type: 'text', placeholder: 'Ej: 110V, 220V' },
  powerWatts: { name: 'powerWatts', label: 'Potencia (Watts)', type: 'number', min: 0, placeholder: '500' },
  compatibility: { name: 'compatibility', label: 'Compatibilidad', type: 'textarea', placeholder: 'Compatible con...' },
  includesAccessories: { name: 'includesAccessories', label: 'Incluye', type: 'textarea', placeholder: 'Cable USB, Cargador, etc.' },
  productCondition: {
    name: 'productCondition', label: 'Estado', type: 'select', defaultValue: 'nuevo',
    options: [
      { value: 'nuevo', label: 'Nuevo' }, { value: 'reacondicionado', label: 'Reacondicionado' },
      { value: 'usado', label: 'Usado' }, { value: 'exhibición', label: 'Exhibicion' }
    ]
  },
  // Farmacia
  activeIngredient: { name: 'activeIngredient', label: 'Principio Activo', type: 'text', placeholder: 'Ej: Paracetamol' },
  concentration: { name: 'concentration', label: 'Concentracion', type: 'text', placeholder: 'Ej: 500mg' },
  requiresPrescription: { name: 'requiresPrescription', label: 'Requiere Receta', type: 'boolean', defaultValue: false },
  administrationRoute: {
    name: 'administrationRoute', label: 'Via de Administracion', type: 'select',
    options: [
      { value: 'oral', label: 'Oral' }, { value: 'topica', label: 'Topica' },
      { value: 'inyectable', label: 'Inyectable' }, { value: 'inhalada', label: 'Inhalada' },
      { value: 'oftalmica', label: 'Oftalmica' }, { value: 'otica', label: 'Otica' },
      { value: 'rectal', label: 'Rectal' }, { value: 'sublingual', label: 'Sublingual' }
    ]
  },
  presentation: { name: 'presentation', label: 'Presentacion', type: 'text', placeholder: 'Ej: Tabletas, Jarabe' },
  unitsPerPackage: { name: 'unitsPerPackage', label: 'Unidades por Empaque', type: 'number', min: 1, placeholder: '20' },
  laboratory: { name: 'laboratory', label: 'Laboratorio', type: 'text', placeholder: 'Nombre del laboratorio' },
  contraindications: { name: 'contraindications', label: 'Contraindicaciones', type: 'textarea', placeholder: 'Situaciones en que no se debe usar' },
  // Ferreteria
  dimensions: { name: 'dimensions', label: 'Dimensiones', type: 'text', placeholder: 'Ej: 10 x 20 x 30 cm' },
  weight: { name: 'weight', label: 'Peso', type: 'number', min: 0, step: 0.001, placeholder: '2.5', description: 'Usado para asignar vehículo de despacho' },
  hardwareWeightUnit: {
    name: 'hardwareWeightUnit', label: 'Unidad de Peso', type: 'select', defaultValue: 'kg',
    options: [
      { value: 'kg', label: 'Kilogramos (kg)' },
      { value: 'ton', label: 'Toneladas (ton)' },
      { value: 'lb', label: 'Libras (lb)' },
      { value: 'g', label: 'Gramos (g)' },
    ]
  },
  caliber: { name: 'caliber', label: 'Calibre/Grosor', type: 'text', placeholder: 'Ej: 1/2", 3/4"' },
  resistance: { name: 'resistance', label: 'Resistencia', type: 'text', placeholder: 'Ej: 500 PSI' },
  finish: { name: 'finish', label: 'Acabado', type: 'text', placeholder: 'Ej: Galvanizado, Cromado' },
  recommendedUse: { name: 'recommendedUse', label: 'Uso Recomendado', type: 'textarea', placeholder: 'Para que se recomienda usar' },
  // Libreria
  author: { name: 'author', label: 'Autor', type: 'text', placeholder: 'Nombre del autor' },
  publisher: { name: 'publisher', label: 'Editorial', type: 'text', placeholder: 'Nombre de la editorial' },
  isbn: { name: 'isbn', label: 'ISBN', type: 'text', placeholder: 'Ej: 978-3-16-148410-0' },
  pages: { name: 'pages', label: 'Paginas', type: 'number', min: 1, placeholder: '320' },
  language: {
    name: 'language', label: 'Idioma', type: 'select',
    options: [
      { value: 'español', label: 'Español' }, { value: 'ingles', label: 'Ingles' },
      { value: 'frances', label: 'Frances' }, { value: 'portugues', label: 'Portugues' }, { value: 'otro', label: 'Otro' }
    ]
  },
  publicationYear: { name: 'publicationYear', label: 'Año de Publicacion', type: 'number', min: 1000, max: 2030, placeholder: '2024' },
  edition: { name: 'edition', label: 'Edicion', type: 'text', placeholder: 'Ej: 1ra, 2da' },
  bookFormat: {
    name: 'bookFormat', label: 'Formato', type: 'select',
    options: [
      { value: 'pasta_dura', label: 'Pasta Dura' }, { value: 'pasta_blanda', label: 'Pasta Blanda' },
      { value: 'digital', label: 'Digital' }, { value: 'audio', label: 'Audiolibro' }
    ]
  },
  // Juguetes
  recommendedAge: { name: 'recommendedAge', label: 'Edad Recomendada', type: 'text', placeholder: 'Ej: 3+, 5-10 años' },
  numberOfPlayers: { name: 'numberOfPlayers', label: 'Num. Jugadores', type: 'text', placeholder: 'Ej: 1-4, 2+' },
  gameType: { name: 'gameType', label: 'Tipo de Juego', type: 'text', placeholder: 'Ej: Mesa, Construccion' },
  requiresBatteries: { name: 'requiresBatteries', label: 'Requiere Pilas', type: 'boolean', defaultValue: false },
  packageDimensions: { name: 'packageDimensions', label: 'Dimensiones del Empaque', type: 'text', placeholder: 'Ej: 30 x 20 x 10 cm' },
  packageContents: { name: 'packageContents', label: 'Contenido del Paquete', type: 'textarea', placeholder: 'Lista de piezas incluidas' },
  safetyWarnings: { name: 'safetyWarnings', label: 'Advertencias', type: 'textarea', placeholder: 'Ej: No apto para menores de 3 años' },
}

export function getFieldsForProductType(productType: ProductType): FieldDefinition[] {
  const config = PRODUCT_TYPES[productType]
  if (!config) return []
  return config.fields.map(name => FIELD_DEFINITIONS[name]).filter(Boolean)
}
