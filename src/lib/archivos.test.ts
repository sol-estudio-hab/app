import { describe, expect, it } from 'vitest'
import { extensionParaMime, TAMANO_MAXIMO_BYTES, TIPOS_PERMITIDOS } from './archivos'

describe('TIPOS_PERMITIDOS / TAMANO_MAXIMO_BYTES', () => {
  it('coincide con los tipos y el límite configurados en el bucket de Storage (migración 0002)', () => {
    expect(TIPOS_PERMITIDOS).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ])
    expect(TAMANO_MAXIMO_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('extensionParaMime', () => {
  it('mapea cada tipo permitido a su extensión', () => {
    expect(extensionParaMime('image/jpeg')).toBe('jpg')
    expect(extensionParaMime('image/png')).toBe('png')
    expect(extensionParaMime('image/webp')).toBe('webp')
    expect(extensionParaMime('application/pdf')).toBe('pdf')
  })

  it('devuelve "bin" para un tipo no reconocido', () => {
    expect(extensionParaMime('application/zip')).toBe('bin')
  })
})
