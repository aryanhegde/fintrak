import { z } from "zod";

export const accountNameSchema = z.string().trim().min(1).max(80);
export const categoryNameSchema = z.string().trim().min(1).max(80);
export const payeeSchema = z.string().trim().max(120).nullable().optional();
export const notesSchema = z.string().trim().max(500).nullable().optional();
