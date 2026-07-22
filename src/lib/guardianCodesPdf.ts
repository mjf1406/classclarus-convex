import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

import {
  formatJoinCodeDisplay,
  getJoinPageUrl,
  getJoinUrl,
} from '@/lib/joinCode'

type GuardianCodeStudent = {
  displayName: string
  guardianCode: string
}

type GuardianCodesPdfData = {
  className: string
  year: number
  students: Array<GuardianCodeStudent>
}

type BrandLogo = {
  dataUrl: string
  width: number
  height: number
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const PAGE_MARGIN = 12
const COLUMN_GAP = 6
const ROW_GAP = 6
const COLUMNS = 2
const ROWS = 3
const AVAILABLE_WIDTH =
  PAGE_WIDTH - PAGE_MARGIN * 2 - COLUMN_GAP * (COLUMNS - 1)
const AVAILABLE_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN * 2 - ROW_GAP * (ROWS - 1)
const CARD_SIZE = Math.min(AVAILABLE_WIDTH / COLUMNS, AVAILABLE_HEIGHT / ROWS)
const GRID_WIDTH = COLUMNS * CARD_SIZE + COLUMN_GAP * (COLUMNS - 1)
const GRID_HEIGHT = ROWS * CARD_SIZE + ROW_GAP * (ROWS - 1)
const GRID_OFFSET_X = PAGE_MARGIN + (AVAILABLE_WIDTH - GRID_WIDTH) / 2
const GRID_OFFSET_Y = PAGE_MARGIN + (AVAILABLE_HEIGHT - GRID_HEIGHT) / 2
const CARDS_PER_PAGE = COLUMNS * ROWS

const LOGO_SRC =
  '/brand/icon-left-of-text-different-sizes-removebg-preview.webp'

const INK: [number, number, number] = [24, 41, 52]
const MUTED: [number, number, number] = [91, 108, 118]
const ACCENT: [number, number, number] = [11, 112, 122]
const CUT_LINE: [number, number, number] = [140, 150, 155]

function safeFilename(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function loadImageAsPngDataUrl(src: string): Promise<BrandLogo> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load brand image: ${src}`))
    img.src = src
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to create canvas for brand image')
  }
  context.drawImage(image, 0, 0)
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
}

function logoSize(
  logo: BrandLogo,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const aspect = logo.width / logo.height
  let width = maxWidth
  let height = width / aspect
  if (height > maxHeight) {
    height = maxHeight
    width = height * aspect
  }
  return { width, height }
}

function drawCutBorder(pdf: jsPDF, x: number, y: number): void {
  pdf.setDrawColor(...CUT_LINE)
  pdf.setLineWidth(0.3)
  pdf.setLineDashPattern([1.5, 1.2], 0)
  pdf.rect(x, y, CARD_SIZE, CARD_SIZE, 'S')
  pdf.setLineDashPattern([], 0)
}

async function addStudentCard(
  pdf: jsPDF,
  student: GuardianCodeStudent,
  x: number,
  y: number,
  logo: BrandLogo,
): Promise<void> {
  const joinUrl = getJoinUrl(student.guardianCode)
  const joinPageUrl = getJoinPageUrl()
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: {
      dark: '#182934',
      light: '#FFFFFF',
    },
  })

  drawCutBorder(pdf, x, y)

  const padding = 5
  const contentWidth = CARD_SIZE - padding * 2

  const brand = logoSize(logo, contentWidth * 0.72, 12)
  const brandX = x + (CARD_SIZE - brand.width) / 2
  const brandY = y + padding
  pdf.addImage(logo.dataUrl, 'PNG', brandX, brandY, brand.width, brand.height)

  const midTop = brandY + brand.height + 3
  const qrSize = 28
  const qrX = x + padding
  const qrY = midTop
  pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  const textX = qrX + qrSize + 4
  const textWidth = contentWidth - qrSize - 4
  const textTop = midTop + 3

  pdf.setTextColor(...MUTED)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(6)
  pdf.text('GUARDIAN ACCESS FOR', textX, textTop)

  pdf.setTextColor(...INK)
  pdf.setFontSize(10)
  const nameLines = pdf.splitTextToSize(
    student.displayName,
    textWidth,
  ) as Array<string>
  pdf.text(nameLines.slice(0, 2), textX, textTop + 5)

  const nameOffset = Math.min(nameLines.length, 2) * 4
  pdf.setTextColor(...ACCENT)
  pdf.setFont('courier', 'bold')
  pdf.setFontSize(11)
  pdf.text(
    formatJoinCodeDisplay(student.guardianCode),
    textX,
    textTop + 6.5 + nameOffset,
  )

  const instructionsTop = Math.max(qrY + qrSize, textTop + 10 + nameOffset) + 3
  const instructions: Array<string> = [
    `1. Open ${joinPageUrl} (or scan the QR).`,
    '2. Enter the join code — scanning the QR prefills it for you.',
    '3. Tap Join class while signed in.',
  ]

  pdf.setTextColor(...MUTED)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  let instructionY = instructionsTop
  const instructionLineHeight = 3.8
  const instructionGap = 2
  for (const line of instructions) {
    const wrapped = pdf.splitTextToSize(line, contentWidth) as Array<string>
    const lines = wrapped.slice(0, 3)
    pdf.text(lines, x + padding, instructionY)
    instructionY += lines.length * instructionLineHeight + instructionGap
  }

  pdf.setFontSize(6)
  pdf.text(
    `This code is private. Tell the teacher right away if this slip is lost.`,
    x + CARD_SIZE / 2,
    y + CARD_SIZE - padding,
    { align: 'center' },
  )
}

export async function downloadGuardianCodesPdf(
  data: GuardianCodesPdfData,
): Promise<void> {
  const logo = await loadImageAsPngDataUrl(LOGO_SRC)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const pageCount = Math.max(
    1,
    Math.ceil(data.students.length / CARDS_PER_PAGE),
  )

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    if (pageIndex > 0) {
      pdf.addPage()
    }

    const pageStudents = data.students.slice(
      pageIndex * CARDS_PER_PAGE,
      (pageIndex + 1) * CARDS_PER_PAGE,
    )
    for (let index = 0; index < pageStudents.length; index++) {
      const student = pageStudents[index]
      const column = index % COLUMNS
      const row = Math.floor(index / COLUMNS)
      const x = GRID_OFFSET_X + column * (CARD_SIZE + COLUMN_GAP)
      const y = GRID_OFFSET_Y + row * (CARD_SIZE + ROW_GAP)
      await addStudentCard(pdf, student, x, y, logo)
    }

    if (pageStudents.length === 0) {
      pdf.setTextColor(...MUTED)
      pdf.setFontSize(11)
      pdf.text(
        'No actively enrolled students have guardian codes yet.',
        PAGE_WIDTH / 2,
        PAGE_HEIGHT / 2,
        { align: 'center' },
      )
    }
  }

  const filename =
    safeFilename(`${data.className}-${data.year}-guardian-codes`) ||
    'guardian-codes'
  pdf.save(`${filename}.pdf`)
}
