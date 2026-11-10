import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import

const adapter = new PrismaPg({connectionString: env})
cont
