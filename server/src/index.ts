import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { cron } from '@elysiajs/cron'
import { staticPlugin } from '@elysiajs/static'
import { generateExcel } from './services/excel'
import { sendEmail } from './services/email'
import { format } from 'date-fns'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

// Define the path to the React build folder
const buildPath = path.join(process.cwd(), '..', 'client', 'dist')

const connectionString = 'file:./dev.db'
const adapter = new PrismaLibSql({ url: connectionString })
const prisma = new PrismaClient({ adapter })

const startDay = 15
const endDay = 14

async function processTimesheetSubmission(year: number, month: number, type: 'project' | 'payroll') {
  // Check if we already sent an email for this configuration
  const existing = await prisma.submission.findUnique({
    where: { year_month_type: { year, month, type } },
  })
  if (existing) {
    console.log(`[CRON] ${type} timesheet for ${year}-${month} was already sent. Skipping.`)
    return
  }

  // Fetch all attendance generic data
  const records = await prisma.attendance.findMany()
  const data: Record<string, string> = {}
  for (const r of records) {
    data[r.date] = r.status
  }

  const title = type === 'project' ? 'Project' : 'Payroll'
  let startDate: Date
  let endDate: Date

  if (type === 'project') {
    endDate = new Date(year, month - 1, 14)
    startDate = new Date(year, month - 2, 15)
  } else {
    startDate = new Date(year, month - 1, 1)
    endDate = new Date(year, month, 0)
  }

  // Generate Document
  const buffer = await generateExcel(year, month, type, data)

  const formattedStartDate = format(startDate, 'do MMMM')
  const formattedEndDate = format(endDate, 'do MMMM')
  const dateStr = `${formattedStartDate} to ${formattedEndDate}`
  const filename = `${title}_Timesheet_${process.env.USER_NAME?.split(' ').join('_')}_${dateStr.split(' ').join('_')}.xlsx`

  const emailHtml = `
<p>Dear Concern,</p>

<p>Here is my attached ${title.toLowerCase()} timesheet from <b>${formattedStartDate} to ${formattedEndDate}.</b></p>
<br />
<p>Thanks<br />
${process.env.USER_NAME}</p>
  `.trim()

  await sendEmail({
    to: process.env.SMTP_TO,
    subject: `${title} Timesheet from ${dateStr}`,
    text: `Dear Concern,\n\nHere is my attached ${title.toLowerCase()} timesheet from ${formattedStartDate} to ${formattedEndDate}.\n\nThanks\n${process.env.USER_NAME}`,
    html: emailHtml,
    attachments: [{ filename, content: buffer }],
  })

  // Log successful submission
  await prisma.submission.upsert({
    where: { year_month_type: { year, month, type } },
    update: { sentAt: new Date() },
    create: { year, month, type },
  })

  console.log(`[CRON] SUCCESSFULLY sent ${title} timesheet for ${year}-${month}.`)
}

const app = new Elysia()
  .use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )
  .use(
    cron({
      name: 'payroll-timesheet',
      pattern: '0 1 1 * *',
      async run() {
        console.log('[CRON] Executing Payroll timesheet...')
        const date = new Date()
        const targetMonth = date.getMonth() === 0 ? 12 : date.getMonth()
        const targetYear = date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear()
        await processTimesheetSubmission(targetYear, targetMonth, 'payroll')
      }
    })
  )
  .use(
    cron({
      name: 'project-timesheet',
      pattern: '0 1 15 * *',
      async run() {
        console.log('[CRON] Executing Project timesheet...')
        const date = new Date()
        await processTimesheetSubmission(date.getFullYear(), date.getMonth() + 1, 'project')
      }
    })
  )
  .use(
    staticPlugin({
      assets: buildPath,
      prefix: '/', // Serves the files from the root path
      alwaysStatic: true, // Always serve static files if they match
    }),
  )
  .get('/api/attendance', async ({ query }) => {
    const { year, month } = query
    if (!year || !month) return { error: 'Year and month required' }

    try {
      const records = await prisma.attendance.findMany()
      const attendanceData: Record<string, string> = {}
      for (const r of records) {
        attendanceData[r.date] = r.status
      }
      return attendanceData
    } catch (e) {
      console.error(e)
      return { error: 'Failed to fetch attendance data' }
    }
  })
  .post(
    '/api/attendance',
    async ({ body }) => {
      const { date, status } = body
      try {
        if (!status || status === '') {
          // Optimization: allow removing status by writing empty string
          await prisma.attendance.delete({ where: { date } }).catch(() => {})
        } else {
          await prisma.attendance.upsert({
            where: { date },
            update: { status },
            create: { date, status },
          })
        }
        return { success: true }
      } catch (e) {
        console.error(e)
        return { error: 'Failed to update attendance data' }
      }
    },
    {
      body: t.Object({
        date: t.String(),
        status: t.String(),
      }),
    },
  )
  .post(
    '/api/generate',
    async ({ body }) => {
      const { year, month, type, data } = body
      const buffer = await generateExcel(year, month, type, data)
      const title = type === 'project' ? 'Project' : 'Payroll'

      let startDate: Date
      let endDate: Date

      if (type === 'project') {
        endDate = new Date(year, month - 1, 14)
        startDate = new Date(year, month - 2, 15)
      } else {
        startDate = new Date(year, month - 1, 1)
        endDate = new Date(year, month, 0)
      }

      const dateStr = `${format(startDate, 'MMMM d')} to ${format(endDate, 'MMMM d')}`
      const filename = `${title}_Timesheet_${process.env.USER_NAME?.split(' ').join('_')}_${dateStr.split(' ').join('_')}.xlsx`

      return new Response(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    },
    {
      body: t.Object({
        year: t.Number(),
        month: t.Number(),
        type: t.String(),
        data: t.Record(t.String(), t.String()),
      }),
    },
  )
  .get('/api/submission-status', async ({ query }) => {
    const year = Number(query.year)
    const month = Number(query.month)
    const type = query.type as string

    if (!year || !month || !type) return { error: 'Missing parameters' }

    try {
      const submission = await prisma.submission.findUnique({
        where: {
          year_month_type: { year, month, type },
        },
      })
      return { isSent: !!submission }
    } catch (e) {
      console.error(e)
      return { error: 'Failed to verify submission' }
    }
  })
  .post(
    '/api/send-email',
    async ({ body }) => {
      const { year, month, type } = body
      await processTimesheetSubmission(year, month, type as 'project' | 'payroll')
      return { success: true }
    },
    {
      body: t.Object({
        year: t.Number(),
        month: t.Number(),
        type: t.String(),
      }),
    },
  )
  .get('*', async ({ set }) => {
    const indexPath = Bun.pathToFileURL('../client/dist/index.html').pathname;
    const file = Bun.file(indexPath);
    if (!(await file.exists())) {
      set.status = 404;
      return 'Frontend is not built. In development, please use the Vite dev server (usually localhost:5173).';
    }
    set.headers['content-type'] = 'text/html';
    return await file.text();
  })
  .listen(3001)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
