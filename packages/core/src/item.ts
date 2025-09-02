import { generateId } from "./id";

export interface BaseItem {
  id: string;
  module: string;
  name: string;
  description?: string;
  depends_on?: string[];
}

export function createBaseItem(
  input: Omit<BaseItem, "id"> & { id?: string },
): BaseItem {
  const id = input.id && input.id.length > 0 ? input.id : generateId("item");
  return {
    id,
    module: input.module,
    name: input.name,
    description: input.description,
    depends_on: input.depends_on,
  };
}
