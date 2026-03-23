import ExcelJS from 'exceljs'
import path from 'path'
import { format, addDays, isSaturday, isSunday } from 'date-fns'
import fs from 'fs'

export async function generateExcel(
  year: number,
  month: number,
  type: string,
  data: Record<string, string>,
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook()

    // ✅ Load EXACT template
    const templatePath = path.join(__dirname, '../assets/template.xlsx')
    await workbook.xlsx.readFile(templatePath)

    const sheet = workbook.getWorksheet(1)

    if (!sheet) throw new Error('Worksheet not found')

    // ================= DATE RANGE =================
    let startDate: Date
    let endDate: Date

    if (type === 'project') {
      endDate = new Date(year, month - 1, 14)
      startDate = new Date(year, month - 2, 15)
    } else {
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0)
    }

    // ================= STATIC FIELDS =================
    sheet.getCell('D4').value = 'Western Digital Media'
    sheet.getCell('T4').value = 'Sazzad Anwar'

    sheet.getCell('T5').value = format(startDate, 'dd-MMM-yy')
    sheet.getCell('AA5').value = format(endDate, 'dd-MMM-yy')

    sheet.getCell('D5').value = 'Remote'
    sheet.getCell('D6').value = 'Mr. Weng Chin Tang'

    // ================= DATE GRID =================
    let current = startDate
    let col = 3 // Column C (3) is where date 15 starts in the template
    let totalWorkingDays = 0 // Includes 8 hours and PH
    let totalDaysWorked = 0 // Includes only 8 hours

    while (current <= endDate) {
      const dateStr = format(current, 'yyyy-MM-dd')

      const dateCell = sheet.getCell(8, col)
      const hoursCell = sheet.getCell(9, col)
      const otCell = sheet.getCell(10, col)
      const emptyRowCell = sheet.getCell(11, col)

      // Set the standard column width so the extra days perfectly match the rest
      sheet.getColumn(col).width = 4.5

      const solidBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      }

      // Forcefully strip grey backgrounds and apply strict borders mapping to valid days
      dateCell.fill = { type: 'pattern', pattern: 'none' }
      dateCell.border = solidBorder
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }

      hoursCell.fill = { type: 'pattern', pattern: 'none' }
      hoursCell.border = solidBorder
      hoursCell.alignment = { horizontal: 'center', vertical: 'middle' }

      otCell.fill = { type: 'pattern', pattern: 'none' }
      otCell.border = solidBorder

      // Strip extra backgrounds commonly polluting the empty row below
      emptyRowCell.fill = { type: 'pattern', pattern: 'none' }
      emptyRowCell.border = solidBorder

      // Set valid day value
      dateCell.value = current.getDate()

      const status = data[dateStr]
      const isWeekendDay = isSaturday(current) || isSunday(current)

      // Only leaves (MC/AL/PH) get standard yellow shading now
      if (isWeekendDay) {
        hoursCell.value = isSaturday(current) ? 'SA' : 'SU'
      } else if (status) {
        hoursCell.value = status

        if (['MC', 'AL', 'PH'].includes(status)) {
          hoursCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFF00' },
          }

          if (status === 'AL' || status === 'MC') {
            totalWorkingDays++
          }
        } else if (status === '8') {
          totalWorkingDays++
          totalDaysWorked++
        }
      } else {
        hoursCell.value = 8
        totalWorkingDays++
        totalDaysWorked++
      }

      current = addDays(current, 1)
      col++
    }

    // Cleanly wipe any leftover template columns (e.g. wiping days 29, 30, 31)
    while (col <= 33) {
      sheet.getCell(8, col).value = ''
      sheet.getCell(9, col).value = ''
      sheet.getCell(10, col).value = ''

      sheet.getCell(8, col).fill = { type: 'pattern', pattern: 'none' }
      sheet.getCell(9, col).fill = { type: 'pattern', pattern: 'none' }
      sheet.getCell(10, col).fill = { type: 'pattern', pattern: 'none' }
      sheet.getCell(11, col).fill = { type: 'pattern', pattern: 'none' }

      // Clear borders entirely on unused columns to hide grid structure completely
      sheet.getCell(8, col).border = undefined as any
      sheet.getCell(9, col).border = undefined as any
      sheet.getCell(10, col).border = undefined as any
      sheet.getCell(11, col).border = undefined as any

      col++
    }

    // ================= TOTALS =================
    sheet.getCell('E14').value = totalWorkingDays
    sheet.getCell('Q14').value = totalDaysWorked

    // ================= IMAGES =================
    const empowerLogo = path.join(__dirname, '../assets/template_image_0.png')
    const signature = path.join(__dirname, '../assets/template_image_1.jpg')

    try {
      if (fs.existsSync(empowerLogo)) {
        const img1 = workbook.addImage({
          filename: empowerLogo,
          extension: 'png',
        })
        // Center the signature horizontally over the "Employee Signature" line
        sheet.addImage(img1, {
          tl: { col: 1.5, row: 14.2 },
          ext: { width: 120, height: 45 },
        })
      }

      if (fs.existsSync(signature)) {
        const img2 = workbook.addImage({
          filename: signature,
          extension: 'jpeg',
        })
        // Placing the logo visually centered across cols B, C, D, E
        sheet.addImage(img2, {
          tl: { col: 1.3, row: 0.2 },
          ext: { width: 160, height: 45 },
        })
      }
    } catch (e) {
      console.log('Skipped adding images:', e)
    }

    // ================= OUTPUT =================
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('ERROR generating Excel:', err)
    throw err
  }
}
