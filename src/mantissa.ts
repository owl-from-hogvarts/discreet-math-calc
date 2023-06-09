import { Bit, Byte } from "./byte";
import { Register } from "./int16";

type TRawMantissaTuple = [Byte, Byte]

export type TMantissaFormat = {
  bitsUsed: number
  digitWidth: number
  hiddenOne: boolean
}

export const F1Mantissa: TMantissaFormat = {
  bitsUsed: 12,
  digitWidth: 4,
  hiddenOne: false

}

export const F2Mantissa: TMantissaFormat = {
  bitsUsed: 11,
  digitWidth: 1,
  hiddenOne: true
}

export class Mantissa {
  
  private data: Register;
  private readonly ZERO_TRAIL_WIDTH: number

  get rawNumber() {
    return this.numberWithoutTrail(this.data.number, this.FORMAT.hiddenOne)
  }

  get number() {
    if (this.FORMAT.hiddenOne) {
      const number = this.recoverHiddenOne().rawNumber
      this.shiftLeft(true)
      return number
    }

    return this.rawNumber
  }

  get raw() {
    return this.data.formattedBin
  }

  get withoutTrail() {
    return new Register(2).set(this.number)
  }

  private numberWithoutTrail(number: bigint, useExtendedBitGrid: boolean = false): bigint {
    return number >> BigInt(this.ZERO_TRAIL_WIDTH - +useExtendedBitGrid)
  }

  constructor(number: bigint | number, public readonly FORMAT: TMantissaFormat = F1Mantissa) {
    number = BigInt(number)
    this.data = new Register(2)
    this.ZERO_TRAIL_WIDTH = this.data.WIDTH * Byte.LENGTH - this.FORMAT.bitsUsed

    const overflowedDigit = Mantissa.getDigit(number, Mantissa.computeAmountOfDigits(FORMAT), FORMAT)
    let toStore = number

    if (!(FORMAT.hiddenOne && overflowedDigit)) {
      // normalized
      toStore = Mantissa.normalize(number, FORMAT, this.ZERO_TRAIL_WIDTH) << BigInt(FORMAT.hiddenOne ? FORMAT.digitWidth : 0)
    }

    const normalizedWithTrail = toStore << BigInt(this.ZERO_TRAIL_WIDTH)
    this.data.set(normalizedWithTrail)
    console.log("raw mantissa", this.raw)
  }

  recoverHiddenOne() {
    this.data.shiftRight(1)

    for (let i = 0; i < this.FORMAT.digitWidth - 1; i++) {
      this.data.shiftRight(0)
    }

    return this
  }

  shiftRightFillWithOne() {
    this.recoverHiddenOne()
    this.zeroTrail(this.FORMAT.hiddenOne)

    return this
  }

  shiftRight(useExtendedBitGrid = false) {
    console.log("shifting right")

    const digitWidth = this.FORMAT.digitWidth

    for(let i = 0; i < digitWidth; i++) {
      this.data.shiftRight(0)
    }

    this.zeroTrail(useExtendedBitGrid)

    return this
  }

  shiftLeft(useExtendedBitGrid = false) {
    for (let i = 0; i < this.FORMAT.digitWidth; i++) {
      this.data.shiftLeft()
    }

    this.zeroTrail(useExtendedBitGrid)


    return this
  }

  zeroTrail(useExtendedBitGrid = false) {
    for( let i = 0; i < this.ZERO_TRAIL_WIDTH - +useExtendedBitGrid; i++) {
      this.data.shiftRight(0)
    }

    for( let i = 0; i < this.ZERO_TRAIL_WIDTH - +useExtendedBitGrid; i++) {
      this.data.shiftLeft(0)
    }

    return this
  }

  static normalize(number: bigint, format: TMantissaFormat, ZERO_TRAIL_WIDTH: number): bigint {
    const digitsAmount = Mantissa.computeAmountOfDigits(format)

    for (let i = 0; i < digitsAmount; i++) {
      if (!Mantissa.isRightDenormalized(number, format)) {
        break;
      }
      // console.log("number", number.toString(2))

      number = number << BigInt(format.digitWidth)
    }

    return number
  }

  static isRightDenormalized(number: bigint, format: TMantissaFormat) {
    const digitsAmount = Mantissa.computeAmountOfDigits(format)
    const mostSignificantDigit = digitsAmount - 1;
    return !Mantissa.getDigit(number, mostSignificantDigit, format)
  }

  static computeAmountOfDigits(format: TMantissaFormat) {
    return format.bitsUsed / format.digitWidth
  }

  /** operates on numbers without trail */
  private static getDigit(number: bigint, index: number, format: TMantissaFormat) {
    const mask = parseInt("1".repeat(format.digitWidth), 2) << (format.digitWidth * index)
    return number & BigInt(mask)
  }

  normalize(): number {
    let count = 0
    const digitsAmount = Mantissa.computeAmountOfDigits(this.FORMAT)
    console.log("normalizing")
    for (let i = 0; i < digitsAmount; i++) {
      if (!Mantissa.isRightDenormalized(this.rawNumber, this.FORMAT)) {
        break
      }
      this.shiftLeft()
      count++
    }

    console.log("count", count)

    return count
   }

  add(mantissa: Mantissa): Bit {
    return this.data.add(mantissa.data)
  }

  subtract(mantissa: Mantissa): Bit {
    console.log(`subtracting ${this.raw} - ${mantissa.raw}`)
    const carryOut = this.data.subtract(mantissa.data)
    console.log("mantissa right after subtraction", this.raw)
    
    const abs = (n: bigint) => (n === -0n || n < 0n) ? -n : n;

    if (carryOut) {
      this.data.set(abs(this.data.numberSigned))
    }

    return carryOut
  }
}

// const a = new Mantissa(0xf05)
// const b = new Mantissa(0x5)
// const f = new Mantissa(0b0110, F2Mantissa)
// const x = new Mantissa(0b1, F2Mantissa)
// const y = new Mantissa(0b10001, F2Mantissa)
// const long = new Mantissa(0b1011_1111_1111, F2Mantissa)
// console.log(long.raw)

// console.log(a.raw)
// console.log(b.raw)
// console.log(f.raw)
// console.log(x.raw)
// console.log(y.raw)

