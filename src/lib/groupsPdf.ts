import { jsPDF } from 'jspdf'

type GroupsPdfStudent = {
  displayName: string
}

type GroupsPdfTeam = {
  name: string
  students: Array<GroupsPdfStudent>
}

type GroupsPdfGroup = {
  name: string
  description?: string
  studentsWithoutTeam: Array<GroupsPdfStudent>
  teams: Array<GroupsPdfTeam>
}

export type GroupsPdfData = {
  className: string
  year: number
  groups: Array<GroupsPdfGroup>
}

type BrandLogo = {
  dataUrl: string
  width: number
  height: number
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const PAGE_MARGIN = 14

const LOGO_SRC =
  '/brand/icon-left-of-text-different-sizes-removebg-preview.webp'

const INK: [number, number, number] = [24, 41, 52]
const MUTED: [number, number, number] = [91, 108, 118]
const ACCENT: [number, number, number] = [11, 112, 122]

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

function ensureSpace(
  pdf: jsPDF,
  y: number,
  needed: number,
  logo: BrandLogo,
): number {
  if (y + needed <= PAGE_HEIGHT - PAGE_MARGIN) return y
  pdf.addPage()
  return drawPageHeader(pdf, logo, null, null)
}

function drawPageHeader(
  pdf: jsPDF,
  logo: BrandLogo,
  className: string | null,
  year: number | null,
): number {
  const brand = logoSize(logo, 48, 14)
  pdf.addImage(
    logo.dataUrl,
    'PNG',
    PAGE_MARGIN,
    PAGE_MARGIN,
    brand.width,
    brand.height,
  )

  let y = PAGE_MARGIN + brand.height + 6
  if (className !== null && year !== null) {
    pdf.setTextColor(...INK)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(className, PAGE_MARGIN, y)
    y += 6
    pdf.setTextColor(...MUTED)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(String(year), PAGE_MARGIN, y)
    y += 8
  } else {
    y += 4
  }
  return y
}

function drawStudentList(
  pdf: jsPDF,
  students: Array<GroupsPdfStudent>,
  x: number,
  startY: number,
  logo: BrandLogo,
): number {
  let y = startY
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(...INK)
  for (const student of students) {
    y = ensureSpace(pdf, y, 5, logo)
    pdf.text(`• ${student.displayName}`, x, y)
    y += 5
  }
  return y
}

export async function downloadGroupsPdf(data: GroupsPdfData): Promise<void> {
  const logo = await loadImageAsPngDataUrl(LOGO_SRC)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let y = drawPageHeader(pdf, logo, data.className, data.year)

  pdf.setTextColor(...ACCENT)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Groups & Teams', PAGE_MARGIN, y)
  y += 8

  if (data.groups.length === 0) {
    pdf.setTextColor(...MUTED)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text('No groups yet.', PAGE_MARGIN, y)
  }

  for (const group of data.groups) {
    y = ensureSpace(pdf, y, 14, logo)
    pdf.setTextColor(...INK)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.text(group.name, PAGE_MARGIN, y)
    y += 5

    if (group.description) {
      y = ensureSpace(pdf, y, 8, logo)
      pdf.setTextColor(...MUTED)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      const lines = pdf.splitTextToSize(
        group.description,
        PAGE_WIDTH - PAGE_MARGIN * 2,
      ) as Array<string>
      pdf.text(lines, PAGE_MARGIN, y)
      y += lines.length * 4 + 2
    }

    if (group.studentsWithoutTeam.length > 0) {
      y = ensureSpace(pdf, y, 6, logo)
      pdf.setTextColor(...MUTED)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Members', PAGE_MARGIN + 2, y)
      y += 5
      y = drawStudentList(
        pdf,
        group.studentsWithoutTeam,
        PAGE_MARGIN + 4,
        y,
        logo,
      )
      y += 2
    }

    const teamsWithStudents = group.teams.filter(
      (team) => team.students.length > 0,
    )
    for (const team of teamsWithStudents) {
      y = ensureSpace(pdf, y, 10, logo)
      pdf.setTextColor(...ACCENT)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(team.name, PAGE_MARGIN + 2, y)
      y += 5
      y = drawStudentList(pdf, team.students, PAGE_MARGIN + 4, y, logo)
      y += 2
    }

    if (
      group.studentsWithoutTeam.length === 0 &&
      teamsWithStudents.length === 0
    ) {
      y = ensureSpace(pdf, y, 6, logo)
      pdf.setTextColor(...MUTED)
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(9)
      pdf.text('No students assigned', PAGE_MARGIN + 2, y)
      y += 5
    }

    y += 4
  }

  const filename =
    safeFilename(`${data.className}-${data.year}-groups`) || 'groups'
  pdf.save(`${filename}.pdf`)
}
