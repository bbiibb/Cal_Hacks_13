import { describe, expect, it } from 'vitest'
import { detectLayer1, isValidSsn, normalizeSpokenDigits } from './detectors'
import type { PiiType } from './types'

/** The detected pieces as [type, matched text]. */
function found(text: string, names: string[] = []): [PiiType, string][] {
  return detectLayer1(text, names).map((s) => [s.type, text.slice(s.start, s.end)])
}

describe('SSN', () => {
  it.each(['123-45-6789', '123 45 6789', '123456789'])('finds %s', (ssn) => {
    expect(found(`My SSN is ${ssn}.`)).toEqual([['SSN', ssn]])
  })

  it('rejects invalid numbers', () => {
    for (const bad of ['000-12-3456', '666-12-3456', '900-12-3456', '123-00-6789', '123-45-0000']) {
      expect(found(`code ${bad}`)).toEqual([])
      expect(isValidSsn(bad.replace(/-/g, ''))).toBe(false)
    }
  })

  it('still redacts an invalid number that is labelled as an SSN', () => {
    expect(found('my social security number is 000-12-3456')).toEqual([['SSN', '000-12-3456']])
  })

  it('catches spoken digits', () => {
    expect(normalizeSpokenDigits('one two three, four five, six seven eight nine')).toBe('123456789')
    expect(found('my number is one two three, four five, six seven eight nine ok')).toEqual([
      ['SSN', 'one two three, four five, six seven eight nine'],
    ])
    expect(found('it is 123 four five 6789')).toEqual([['SSN', '123 four five 6789']])
  })
})

describe('other identifiers', () => {
  it('finds phone numbers', () => {
    expect(found('Call me at (555) 123-4567 please')).toEqual([['PHONE', '(555) 123-4567']])
    expect(found('+1 415-555-0199')).toEqual([['PHONE', '+1 415-555-0199']])
    expect(found('5551234567')).toEqual([['PHONE', '5551234567']])
    expect(found('five five five, one two three, four five six seven')).toEqual([
      ['PHONE', 'five five five, one two three, four five six seven'],
    ])
  })

  it('finds emails', () => {
    expect(found('write jane.doe+x@example.co.uk now')).toEqual([['EMAIL', 'jane.doe+x@example.co.uk']])
  })

  it('finds medical record numbers but keeps the label', () => {
    expect(found('MRN 12345678')).toEqual([['MRN', '12345678']])
    expect(found('my medical record number is A1234567')).toEqual([['MRN', 'A1234567']])
  })

  it('finds addresses', () => {
    expect(found('I live at 742 Evergreen Terrace, Springfield, IL 62704 now')).toEqual([
      ['ADDRESS', '742 Evergreen Terrace, Springfield, IL 62704'],
    ])
    expect(found('send it to 12 oak street apt 4')).toEqual([['ADDRESS', '12 oak street apt 4']])
    expect(found('zip code 94704')).toEqual([['ADDRESS', '94704']])
  })
})

describe('dates of birth', () => {
  it.each([
    '03/03/1985',
    '3-3-85',
    '03.03.1985',
    '1985-03-03',
    'March 3, 1985',
    'Mar 3rd 1985',
    '3 March 1985',
    "3rd of March '85",
  ])('finds %s', (date) => {
    expect(found(`I was born ${date}.`).filter(([t]) => t === 'DOB').map(([, v]) => v)).toContain(date)
  })

  it('accepts a two-digit year after a birth cue', () => {
    expect(found('born March 3, 85').some(([t]) => t === 'DOB')).toBe(true)
  })

  it('finds a birth year', () => {
    expect(found('I was born in 1985 and')).toEqual([['DOB', '1985']])
  })

  it('ignores things that are not dates', () => {
    expect(found('my blood pressure is 120/80 and I take 5 mg')).toEqual([])
    expect(found('13/13/1985')).toEqual([])
  })
})

describe('names', () => {
  it('finds introductions', () => {
    expect(found("I'm Jane Doe, born 03/03/1985")).toEqual([
      ['PERSON', 'Jane Doe'],
      ['DOB', '03/03/1985'],
    ])
    expect(found('my name is jane doe and I have a question')).toEqual([['PERSON', 'jane doe']])
    expect(found('Hello, this is John Smith calling')).toEqual([['PERSON', 'John Smith']])
  })

  it('does not take ordinary sentences for names', () => {
    expect(found("I'm Worried about the stent")).toEqual([])
    expect(found('I am allergic to latex')).toEqual([])
    expect(found('this is Important')).toEqual([])
  })

  it('finds names from the intake form, any case, and joins first and last', () => {
    expect(found('Does jane doe need blood thinners? Ask for DOE', ['Jane', 'Doe', 'Jane Doe'])).toEqual([
      ['PERSON', 'jane doe'],
      ['PERSON', 'DOE'],
    ])
    expect(found("Jane's valve", ['Jane'])).toEqual([['PERSON', 'Jane']])
    expect(found('Janet is fine', ['Jane'])).toEqual([])
  })
})

describe('no PII', () => {
  it('finds nothing in ordinary medical questions', () => {
    for (const text of [
      'What happens in step 3 of TAVI?',
      'Is the recovery 2 to 3 days, and can I take 81 mg aspirin?',
      'Zoom in on the aortic valve',
      'one two three',
    ]) {
      expect(found(text)).toEqual([])
    }
  })
})
