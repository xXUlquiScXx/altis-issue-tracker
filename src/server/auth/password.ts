import { compare, hash } from 'bcryptjs'

// Costo 10: unos ~100 ms por hash; suficiente y no pesa en serverless.
const COST = 10

export function hashPassword(password: string) {
  return hash(password, COST)
}

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash)
}
