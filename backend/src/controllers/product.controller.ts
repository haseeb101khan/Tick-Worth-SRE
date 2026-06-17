import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { createProductSchema, updateProductSchema, setVariantsSchema } from '../utils/validators';

export async function list(req: Request, res: Response) {
  const { brand, category, search } = req.query;
  const products = await productService.listProducts({
    brand: typeof brand === 'string' ? brand : undefined,
    category: typeof category === 'string' ? category : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  res.json(products);
}

export async function getOne(req: Request, res: Response) {
  const product = await productService.getProduct(req.params.id);
  res.json(product);
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  const product = await productService.createProduct(input);
  res.status(201).json(product);
}

export async function update(req: Request, res: Response) {
  const input = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(req.params.id, {
    ...input,
    // An empty imageUrl clears the column (null) rather than storing "".
    imageUrl: input.imageUrl === '' ? null : input.imageUrl,
  });
  res.json(product);
}

// Staff-only: replace a product's colour variants (the catalog colour manager).
export async function setVariants(req: Request, res: Response) {
  const { variants } = setVariantsSchema.parse(req.body);
  const result = await productService.setVariants(req.params.id, variants);
  res.json(result);
}
