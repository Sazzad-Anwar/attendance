import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  format,
  addDays,
  subMonths,
  isSaturday,
  isSunday,
  getDate,
  eachDayOfInterval,
} from 'date-fns'
import { toast } from 'sonner'
import {
  Download,
  Send,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
  CheckCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')

function App() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [timesheetType, setTimesheetType] = useState<'project' | 'payroll'>(
    'project',
  )
  const [isEmailSent, setIsEmailSent] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // Ping API every 10 minutes to prevent background sleeping
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/attendance`, {
          params: { year, month, type: timesheetType },
        })
        setAttendance(res.data)
      } catch (error) {
        console.log(error)
      }
    }
    const pingInterval = setInterval(() => fetchData(), 3 * 60 * 1000)

    // Initial ping on load
    fetchData()

    return () => clearInterval(pingInterval)
  }, [month, timesheetType, year])

  useEffect(() => {
    const checkSubmission = async () => {
      try {
        const res = await axios.get(`${API_BASE}/submission-status`, {
          params: { year, month, type: timesheetType },
        })
        setIsEmailSent(res.data.isSent)
      } catch (err) {
        console.error('Failed to check submission status:', err)
      }
    }
    checkSubmission()
  }, [year, month, timesheetType])

  // Calculate range
  let startDate, endDate
  if (timesheetType === 'project') {
    startDate = new Date(year, currentDate.getMonth() - 1, 15)
    endDate = new Date(year, currentDate.getMonth(), 14)
  } else {
    startDate = new Date(year, currentDate.getMonth(), 1)
    endDate = new Date(year, currentDate.getMonth() + 1, 0)
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const toggleStatus = async (date: Date) => {
    if (isSaturday(date) || isSunday(date)) return

    const dateStr = format(date, 'yyyy-MM-dd')
    const currentStatus = attendance[dateStr] || '8'

    let nextStatus = '8'
    if (currentStatus === '8') nextStatus = 'MC'
    else if (currentStatus === 'MC') nextStatus = 'AL'
    else if (currentStatus === 'AL') nextStatus = 'PH'
    else nextStatus = '8'

    setAttendance({ ...attendance, [dateStr]: nextStatus })
    try {
      await axios
        .post(`${API_BASE}/attendance`, { date: dateStr, status: nextStatus })
        .catch((err) => console.error(err))
    } catch (error) {
      console.error('Failed to update attendance', error)
      toast.error((error as { message: string })?.message)
    }
  }

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await axios.post(
        `${API_BASE}/generate`,
        { year, month, type: timesheetType, data: attendance },
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute(
        'download',
        `${timesheetType === 'project' ? 'Project' : 'Payroll'}_Timesheet_${year}_${month}.xlsx`,
      )
      document.body.appendChild(link)
      link.click()
      toast.success('Timesheet downloaded successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate Excel')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/send-email`, {
        year,
        month,
        type: timesheetType,
        data: attendance,
      })
      toast.success(`Email sent successfully`)
      setIsEmailSent(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/30 overflow-hidden font-sans flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Ambient glowing orbs for background */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/20 blur-[120px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <Card className="shadow-[0_8px_32px_rgba(0,0,0,0.5)] gap-0 rounded-md overflow-hidden border border-white/5 bg-white/2 backdrop-blur-3xl ring-1 ring-white/2 py-0">
          <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/5 bg-white/1 p-4 sm:p-5 sm:pb-0 [.border-b]:pb-2">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <CalendarIcon className="w-6 h-6 text-indigo-400" />
                </div>
                {timesheetType === 'project' ? 'Project' : 'Payroll'} Timesheet
              </CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2 font-medium text-zinc-400">
                Sazzad Anwar • Automated Tracker
              </CardDescription>
            </div>

            <div className="flex flex-col items-center sm:items-end gap-2.5 w-full md:w-auto">
              <div className="flex items-center justify-between w-[200px] p-1 h-11 bg-black/40 rounded border border-white/5 shadow-inner backdrop-blur-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="h-8 w-8 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-32 text-center text-sm font-semibold text-zinc-200 tracking-wide">
                  {format(currentDate, 'MMMM yyyy')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentDate(addDays(currentDate, 31))}
                  className="h-8 w-8 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Select
                value={timesheetType}
                onValueChange={(v) =>
                  setTimesheetType(v as 'project' | 'payroll')
                }
              >
                <SelectTrigger className="w-[200px] h-11 rounded text-white border-0 font-medium text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded border-zinc-800 bg-zinc-950/95 backdrop-blur-xl text-zinc-200 shadow-2xl">
                  <SelectItem
                    value="project"
                    className="focus:bg-zinc-800 focus:text-white cursor-pointer py-2.5"
                  >
                    Project Mode (15th-14th)
                  </SelectItem>
                  <SelectItem
                    value="payroll"
                    className="focus:bg-zinc-800 focus:text-white cursor-pointer py-2.5"
                  >
                    Payroll Mode (1st-EOM)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:px-5 sm:py-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-wide">
                  Attendance Log
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse"></span>
                  {format(startDate, 'MMM dd, yyyy')} —{' '}
                  {format(endDate, 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  onClick={handleDownload}
                  disabled={loading}
                  className="gap-2 rounded"
                >
                  <Download className="w-4 h-4" /> Download
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={loading || isEmailSent}
                  className="gap-2 rounded"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : isEmailSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Already Submitted
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit to HR
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4 bg-black/20 p-3 rounded-xl border border-white/3 shadow-inner">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mr-2">
                Status:
              </span>
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-300 border-blue-500/20 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 mr-2 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
                Working
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-300 border-amber-500/20 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 mr-2 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
                Medical
              </Badge>
              <Badge
                variant="outline"
                className="bg-purple-500/10 text-purple-300 border-purple-500/20 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-purple-400 mr-2 shadow-[0_0_8px_rgba(192,132,252,0.8)]"></div>
                Annual
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                Holiday
              </Badge>
              <Badge
                variant="outline"
                className="bg-zinc-800/40 text-zinc-400 border-white/5 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-zinc-600 mr-2"></div>
                Weekend
              </Badge>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-widest pb-2"
                >
                  {d}
                </div>
              ))}

              {Array.from({
                length: days.length > 0 ? days[0].getDay() : 0,
              }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-full aspect-square"
                />
              ))}

              {days.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const isWeekend = isSaturday(date) || isSunday(date)
                const status = isWeekend
                  ? isSaturday(date)
                    ? 'SA'
                    : 'SU'
                  : attendance[dateStr] || '8'

                let boxStyles =
                  'bg-white/2 border-white/5 text-zinc-300 hover:border-indigo-500/40 hover:bg-indigo-500/5 cursor-pointer backdrop-blur-md'

                if (isWeekend) {
                  boxStyles =
                    'bg-black/20 border-transparent text-zinc-600 cursor-not-allowed'
                } else if (status === 'MC') {
                  boxStyles =
                    'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-400/80 hover:bg-amber-500/15 cursor-pointer backdrop-blur-md shadow-[inset_0_0_15px_rgba(251,191,36,0.05)]'
                } else if (status === 'AL') {
                  boxStyles =
                    'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:border-purple-400/80 hover:bg-purple-500/15 cursor-pointer backdrop-blur-md shadow-[inset_0_0_15px_rgba(192,132,252,0.05)]'
                } else if (status === 'PH') {
                  boxStyles =
                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-400/80 hover:bg-emerald-500/15 cursor-pointer backdrop-blur-md shadow-[inset_0_0_15px_rgba(52,211,153,0.05)]'
                } else if (status === '8') {
                  boxStyles =
                    'bg-blue-500/5 border-blue-500/30 text-blue-200 hover:border-blue-400/80 hover:bg-blue-500/15 cursor-pointer backdrop-blur-md shadow-[inset_0_0_15px_rgba(96,165,250,0.05)]'
                }

                return (
                  <div
                    key={dateStr}
                    onClick={() => toggleStatus(date)}
                    className={`relative w-full max-w-[44px] sm:max-w-[70px] lg:max-w-[80px] aspect-square mx-auto rounded-xl border flex flex-col items-center justify-center transition-all duration-300 p-1 group hover:-translate-y-0.5 hover:shadow-md ${boxStyles}`}
                  >
                    <span className="text-base sm:text-lg lg:text-xl font-bold tracking-tight">
                      {status === '8' ? '8h' : status}
                    </span>
                    <span className="absolute bottom-1 right-1.5 sm:bottom-2 sm:right-2.5 text-[9px] sm:text-[10px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {getDate(date)}
                    </span>
                    {!isWeekend && status === '8' && (
                      <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>
                    )}
                  </div>
                )
              })}

              {Array.from({
                length:
                  42 - ((days.length > 0 ? days[0].getDay() : 0) + days.length),
              }).map((_, i) => (
                <div
                  key={`empty-end-${i}`}
                  className="w-full aspect-square"
                />
              ))}
            </div>
          </CardContent>

          <CardFooter className="bg-black/20 border-t [.border-t]:pt-4 border-white/5 px-4 pt-0 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
            <p className="text-xs font-medium text-zinc-500 tracking-wide">
              Generated for MPOWER Technical Services
            </p>
            <div className="text-xs font-medium text-zinc-500 bg-white/3 px-3 py-1.5 rounded-full border border-white/5">
              HR: <span className="text-zinc-300">hr@mpowerts.com</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default App
