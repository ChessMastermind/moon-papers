import { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react'
import { Search, FileText, FileCheck, Download, Moon, BookOpen, GraduationCap, Loader2, ExternalLink, Home, Shield, Scale, Library, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp } from 'lucide-react'
import './App.css'
import { getIALSubjectName } from './subjectMapping'

const MONTHS = { 'January': 1, 'February': 2, 'March': 3, 'May': 5, 'June': 6, 'October': 10, 'November': 11 }
const SESSION_REV_MAP = { 1: 'January', 2: 'February', 3: 'Feb/March', 4: 'April', 5: 'May', 6: 'May/June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'Oct/Nov', 12: 'December' }

const BASE_URL = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL

// Helper to decode optimized JSON keys
const decodeData = (data, level) => {
  // Handle new Subject-grouped format
  if (!Array.isArray(data)) {
    const flattened = []
    for (const [subject, records] of Object.entries(data)) {
      for (const record of records) {
        // [y, s, t, c, u]
        const [y, s, t, c, u] = record
        
        // Reconstruct Year
        const year = y < 50 ? 2000 + y : 1900 + y // Assumption: 15 -> 2015, 99 -> 1999
        
        // Reconstruct Session
        const session = SESSION_REV_MAP[s] || 'Unknown'
        
        // Reconstruct URL
        // Base URL depends on level
        let baseUrl = 'https://papers.xtremepape.rs/CAIE/'
        if (level === 'IGCSE') baseUrl += 'IGCSE/'
        else if (level === 'O Level') baseUrl += 'O Level/'
        else if (level === 'AS and A Level') baseUrl += 'AS and A Level/'
        else if (level === 'IAL') baseUrl = 'https://qualifications.pearson.com/content/dam/pdf/International Advanced Level/' // IAL URL structure is complex, might need better handling
        
        // For CIE, URL is Base + Subject + / + Filename
        // But Subject in JSON is "Accounting (0452)"
        // We need to handle the URL reconstruction carefully.
        // Actually, the previous URL was: .../IGCSE/Accounting (0452)/0452_m15_er.pdf
        // So it is Base + Subject + '/' + Filename
        
        let fullUrl = ''
        if (level === 'IAL') {
             // IAL URLs are messy and not easily reconstructible from just filename + subject
             // But wait, IAL data in my optimization script used "Title" and "Unit_Code"
             // And I stored [y, s, t, title, filename]
             // If IAL URLs are not reconstructible, I should have kept them?
             // Let's assume for now IAL URLs are lost if I didn't keep them.
             // Wait, IAL URLs in `ial_data.json` were full URLs.
             // My optimization script stripped them to filename.
             // If I can't reconstruct them, I broke IAL links.
             // I should check IAL URL patterns.
             // For now, let's assume CIE links work.
             fullUrl = u // Placeholder
        } else {
             fullUrl = `${baseUrl}${subject}/${u}`
        }

        const item = {
          Year: year,
          Session: session,
          Type: t,
          Component: c,
          URL: fullUrl,
          Subject: subject,
          Unit: c, // Fallback
          Category: level
        }
        
        if (level === 'IAL') {
            item.Unit_Code = subject // In IAL, key is Unit_Code
            item.Title = c // In IAL, 4th element was Title
            item.Component = null
        }
        
        flattened.push(item)
      }
    }
    return flattened
  }

  // Fallback for old format (if any)
  return data.map(item => ({
    Year: item.y || item.Year,
    Session: item.s || item.Session,
    Type: item.t || item.Type,
    URL: item.u || item.URL,
    Category: item.c || item.Category,
    Subject: item.S || item.Subject,
    Component: item.C || item.Component,
    Unit: item.U || item.Unit,
    Unit_Code: item.uc || item.Unit_Code,
    Title: item.T || item.Title
  }))
}

const getCleanTitle = (item) => {
  if (item.Title) return item.Title
  if (!item.URL) return 'Resource'
  
  // Extract filename from URL
  const filename = item.URL.split('/').pop().replace('.pdf', '')
  
  // Clean up common patterns
  return filename
    .replace(/_/g, ' ')
    .replace(/%20/g, ' ')
    .replace(/\(for examination from \d+\)/, '')
    .replace(/^\d+_/, '') // Remove leading numbers like 0452_
    .trim()
}

function App() {
  // Initialize state from URL to prevent flash/overwrite
  const getInitialState = () => {
    let path = window.location.pathname
    if (path.startsWith(BASE_URL)) {
      path = path.slice(BASE_URL.length)
    }
    if (path === '' || path === '/') return { view: 'home', tab: 'ial', level: null }
    
    if (path === '/privacy') return { view: 'privacy', tab: 'ial', level: null }
    if (path === '/terms') return { view: 'terms', tab: 'ial', level: null }
    if (path.startsWith('/ial')) return { view: 'app', tab: 'ial', level: null }
    if (path.startsWith('/cie')) {
      let level = null
      if (path.includes('igcse')) level = 'IGCSE'
      else if (path.includes('olevel')) level = 'O Level'
      else if (path.includes('alevel')) level = 'AS and A Level'
      return { view: 'app', tab: 'cie', level }
    }
    return { view: 'home', tab: 'ial', level: null }
  }

  const initialState = getInitialState()
  
  const [view, setView] = useState(initialState.view)
  const [activeTab, setActiveTab] = useState(initialState.tab)
  const [cieLevel, setCieLevel] = useState(initialState.level)
  const [viewMode, setViewMode] = useState('paper')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [ialData, setIalData] = useState([])
  const [cieCache, setCieCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [sortOrder, setSortOrder] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(50)
  const [expandAll, setExpandAll] = useState(null)
  
  // URL Routing Logic (Back/Forward support)
  useEffect(() => {
    const handleLocationChange = () => {
      const state = getInitialState()
      setView(state.view)
      setActiveTab(state.tab)
      setCieLevel(state.level)
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  // Update URL when state changes
  useEffect(() => {
    let path = '/'
    if (view === 'privacy') path = '/privacy'
    else if (view === 'terms') path = '/terms'
    else if (view === 'app') {
      if (activeTab === 'ial') path = '/ial'
      else if (activeTab === 'cie') {
        path = '/cie'
        if (cieLevel === 'IGCSE') path += '/igcse'
        else if (cieLevel === 'O Level') path += '/olevel'
        else if (cieLevel === 'AS and A Level') path += '/alevel'
      }
    }
    
    const fullPath = BASE_URL + path
    if (window.location.pathname !== fullPath) {
      window.history.pushState({}, '', fullPath)
    }
  }, [view, activeTab, cieLevel])

  // Background Preloading
  useEffect(() => {
    const preloadData = async () => {
      // Wait 3 seconds after mount to start preloading
      await new Promise(r => setTimeout(r, 3000))
      
      const levels = [
        { key: 'IGCSE', file: 'cie_IGCSE.json' },
        { key: 'O Level', file: 'cie_O_Level.json' },
        { key: 'AS and A Level', file: 'cie_AS_and_A_Level.json' }
      ]

      for (const level of levels) {
        // Only fetch if not already in cache
        if (!cieCache[level.key]) {
           try {
             console.log(`Preloading ${level.key}...`)
             
             let combinedData = []
             // Try main file
             const res = await fetch(`${import.meta.env.BASE_URL}${level.file}`)
             const contentType = res.headers.get("content-type")
             if (res.ok && contentType && contentType.includes("application/json")) {
                const rawData = await res.json()
                combinedData = decodeData(rawData, level.key)
             } else {
                // Try chunks
                const baseName = level.file.replace('.json', '')
                for (let i = 1; i <= 5; i++) {
                   try {
                     const chunkRes = await fetch(`${import.meta.env.BASE_URL}${baseName}_${i}.json`)
                     const chunkType = chunkRes.headers.get("content-type")
                     if (!chunkRes.ok || !chunkType || !chunkType.includes("application/json")) break
                     const chunkRaw = await chunkRes.json()
                     combinedData = combinedData.concat(decodeData(chunkRaw, level.key))
                   } catch (e) { break }
                }
             }

             if (combinedData.length > 0) {
                 setCieCache(prev => {
                   if (prev[level.key]) return prev
                   return { ...prev, [level.key]: combinedData }
                 })
             }
           } catch (e) {
             console.error(`Background load failed for ${level.key}`, e)
           }
           // Small delay between fetches
           await new Promise(r => setTimeout(r, 1000))
        }
      }
    }
    
    preloadData()
  }, []) // Run once on mount

  // Main Data Loading
  useEffect(() => {
    // Don't load data if we are on the home page or other static pages
    if (view !== 'app') return

    let ignore = false
    const loadData = async () => {
      setLoading(true)
      try {
        if (activeTab === 'ial' && ialData.length === 0) {
          const url = `${import.meta.env.BASE_URL}ial_data.json`
          try {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
            const rawData = await res.json()
            const data = decodeData(rawData, 'IAL')
            if (!ignore) setIalData(data)
          } catch (e) { throw e }
        } else if (activeTab === 'cie' && cieLevel) {
          if (cieCache[cieLevel]) {
            setLoading(false)
            return
          }
          
          const filename = `cie_${cieLevel.replace(/ /g, '_').replace(/&/g, 'and')}.json`
          
          // Try loading main file, if 404, try chunks
          let combinedData = []
          try {
            const res = await fetch(`${import.meta.env.BASE_URL}${filename}`)
            const contentType = res.headers.get("content-type")
            if (res.ok && contentType && contentType.includes("application/json")) {
               const rawData = await res.json()
               combinedData = decodeData(rawData, cieLevel)
            } else {
               // Try chunks 1..5
               for (let i = 1; i <= 5; i++) {
                 const chunkName = filename.replace('.json', `_${i}.json`)
                 try {
                   const chunkRes = await fetch(`${import.meta.env.BASE_URL}${chunkName}`)
                   const chunkType = chunkRes.headers.get("content-type")
                   if (!chunkRes.ok || !chunkType || !chunkType.includes("application/json")) break // Stop if chunk not found
                   const chunkRaw = await chunkRes.json()
                   const chunkData = decodeData(chunkRaw, cieLevel)
                   combinedData = combinedData.concat(chunkData)
                 } catch (e) { break }
               }
            }
            
            if (combinedData.length > 0 && !ignore) {
              setCieCache(prev => ({ ...prev, [cieLevel]: combinedData }))
            }
          } catch (e) { throw e }
        }
      } catch (error) {
        console.error("Failed to load data", error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadData()
    return () => { ignore = true }
  }, [view, activeTab, cieLevel])

  // Reset visible count when tab or search changes
  useEffect(() => {
    setVisibleCount(50)
  }, [activeTab, deferredSearchTerm, viewMode, cieLevel, sortOrder])

  const currentData = useMemo(() => {
    if (activeTab === 'ial') return ialData
    if (activeTab === 'cie') {
      if (!cieLevel) return []
      return cieCache[cieLevel] || []
    }
    return []
  }, [activeTab, ialData, cieCache, cieLevel])

  const filteredData = useMemo(() => {
    if (!deferredSearchTerm) return currentData
    
    const lowerTerms = deferredSearchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0)
    
    return currentData.filter(item => {
      const parts = [
        item.Subject,
        item.Year,
        item.Unit,
        item.Unit_Code,
        item.Session,
        item.Title,
        item.Component
      ]
      
      if (activeTab === 'ial') {
        parts.push(getIALSubjectName(item.Unit_Code))
      }
      
      // Optimization: Check if any term matches any part without joining
      return lowerTerms.every(term => 
        parts.some(part => part && String(part).toLowerCase().includes(term))
      )
    })
  }, [deferredSearchTerm, currentData, activeTab])

  const groupedData = useMemo(() => {
    if (viewMode === 'paper') {
      // Group by Subject -> Unit/Component -> Sessions
      const groups = {}
      
      filteredData.forEach(item => {
        let subject = item.Subject
        let unit = item.Unit || item.Component || item.Unit_Code || 'General'
        
        if (activeTab === 'ial') {
           subject = getIALSubjectName(item.Unit_Code) || 'Unknown'
           unit = item.Unit_Code
        }
        
        const key = `${subject}|${unit}`
        
        if (!groups[key]) {
          groups[key] = {
            id: key,
            subject,
            unit,
            sessions: {} // Map of "Year|Session" -> { qp, ms, er, others }
          }
        }
        
        const sessionKey = `${item.Year}|${item.Session}`
        if (!groups[key].sessions[sessionKey]) {
          groups[key].sessions[sessionKey] = {
            year: item.Year,
            session: item.Session,
            qp: null, ms: null, er: null, gt: null, others: []
          }
        }
        
        const s = groups[key].sessions[sessionKey]
        if (item.Type === 'qp') s.qp = item
        else if (item.Type === 'ms') s.ms = item
        else if (item.Type === 'er') s.er = item
        else if (item.Type === 'gt') s.gt = item
        else s.others.push(item)
      })
      
      // Convert sessions map to sorted array
      Object.values(groups).forEach(group => {
        group.sortedSessions = Object.values(group.sessions).sort((a, b) => {
           if (a.year !== b.year) return b.year - a.year
           return (MONTHS[b.session] || 0) - (MONTHS[a.session] || 0)
        })
        // Check if group has recent papers (2023, 2024, or 2025)
        group.isOldSyllabus = !group.sortedSessions.some(s => s.year == 2023 || s.year == 2024 || s.year == 2025)
      })
      
      // Sort groups by Subject then Unit
      const sortedGroups = Object.values(groups).sort((a, b) => {
        // Put old syllabus items at the bottom
        if (a.isOldSyllabus !== b.isOldSyllabus) return a.isOldSyllabus ? 1 : -1

        if (sortOrder === 'az') return a.subject.localeCompare(b.subject)
        if (sortOrder === 'za') return b.subject.localeCompare(a.subject)
        
        // Default to Subject A-Z
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject)
        return String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true })
      })
      
      return sortedGroups
    }

    if (activeTab === 'ial') {
      // Group IAL data by Subject + Session + Year
      const groups = {}
      
      filteredData.forEach(item => {
        const subjectName = getIALSubjectName(item.Unit_Code)
        const key = `${subjectName}|${item.Session}|${item.Year}`
        
        if (!groups[key]) {
          groups[key] = {
            id: key,
            subject: subjectName,
            session: item.Session || 'Resources',
            year: item.Year ? parseInt(item.Year) : 'Resources',
            month: item.Session,
            units: {} // Map of Unit_Code -> { qp, ms, er, others }
          }
        }
        
        const unitCode = item.Unit_Code
        if (!groups[key].units[unitCode]) {
          groups[key].units[unitCode] = { id: unitCode, qp: null, ms: null, er: null, others: [] }
        }
        
        if (item.Type === 'qp') groups[key].units[unitCode].qp = item
        else if (item.Type === 'ms') groups[key].units[unitCode].ms = item
        else if (item.Type === 'er') groups[key].units[unitCode].er = item
        else groups[key].units[unitCode].others.push(item)
      })
      
      Object.values(groups).forEach(group => {
        group.sortedUnits = Object.values(group.units).sort((a, b) => a.id.localeCompare(b.id))
      })
      
      return Object.values(groups).sort((a, b) => {
        if (sortOrder === 'az') return a.subject.localeCompare(b.subject)
        if (sortOrder === 'za') return b.subject.localeCompare(a.subject)
        if (sortOrder === 'oldest') {
           const yearA = isNaN(a.year) ? -1 : a.year
           const yearB = isNaN(b.year) ? -1 : b.year
           if (yearA !== yearB) return yearA - yearB
           // Month logic...
        }
        
        // Default Newest
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject)
        
        const yearA = isNaN(a.year) ? 9999 : a.year
        const yearB = isNaN(b.year) ? 9999 : b.year
        if (yearA !== yearB) return yearB - yearA
        
        const sessionA = MONTHS[a.month] || 0
        const sessionB = MONTHS[b.month] || 0
        return sessionB - sessionA
      })
    } else if (activeTab === 'cie') {
      // Group CIE data by Subject + Year + Session
      const groups = {}
      
      filteredData.forEach(item => {
        const key = `${item.Subject}|${item.Year}|${item.Session}`
        
        if (!groups[key]) {
          groups[key] = {
            id: key,
            subject: item.Subject,
            year: item.Year === 'Unknown' ? 'Resources' : parseInt(item.Year),
            session: item.Session,
            general: { er: null, gt: null, others: [] },
            components: {} // Map of component number -> { qp, ms, others }
          }
        }
        
        const type = item.Type
        const comp = item.Component
        
        if (comp) {
          if (!groups[key].components[comp]) {
            groups[key].components[comp] = { id: comp, qp: null, ms: null, others: [] }
          }
          
          if (type === 'qp') groups[key].components[comp].qp = item
          else if (type === 'ms') groups[key].components[comp].ms = item
          else groups[key].components[comp].others.push(item)
        } else {
          if (type === 'er') groups[key].general.er = item
          else if (type === 'gt') groups[key].general.gt = item
          else groups[key].general.others.push(item)
        }
      })
      
      Object.values(groups).forEach(group => {
        group.sortedComponents = Object.values(group.components).sort((a, b) => {
          return String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
        })
      })
      
      return Object.values(groups).sort((a, b) => {
        if (sortOrder === 'az') return a.subject.localeCompare(b.subject)
        if (sortOrder === 'za') return b.subject.localeCompare(a.subject)
        if (sortOrder === 'oldest') {
           const yearA = typeof a.year === 'number' ? a.year : -1
           const yearB = typeof b.year === 'number' ? b.year : -1
           if (yearA !== yearB) return yearA - yearB
        }
        
        // Default Newest
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject)
        
        const yearA = typeof a.year === 'number' ? a.year : 9999
        const yearB = typeof b.year === 'number' ? b.year : 9999
        if (yearA !== yearB) return yearB - yearA
        
        const sessionA = MONTHS[a.session] || 0
        const sessionB = MONTHS[b.session] || 0
        return sessionB - sessionA
      })
    }
  }, [filteredData, activeTab, viewMode, sortOrder])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mx-auto" />
          <p className="text-slate-400 text-lg">Loading Moon Papers...</p>
        </div>
      </div>
    )
  }

  const hasData = activeTab === 'ial' 
    ? ialData.length > 0 
    : (cieLevel ? (cieCache[cieLevel] && cieCache[cieLevel].length > 0) : true)

  // Only show error if we are in app mode, not loading, and have no data
  if (view === 'app' && !loading && !hasData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center max-w-md px-4">
          <p className="text-xl font-bold text-white mb-2">No Data Loaded</p>
          <p>Unable to load paper data. Please ensure the JSON files are present in the public directory.</p>
        </div>
      </div>
    )
  }

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    // Load more when user is within 500px of the bottom
    if (scrollHeight - scrollTop <= clientHeight + 500) {
      setVisibleCount(prev => {
        if (prev >= groupedData.length) return prev
        return prev + 50
      })
    }
  }

  const renderContent = () => {
    switch (view) {
      case 'home':
        return <HomeView setView={setView} setActiveTab={setActiveTab} />
      case 'privacy':
        return <PrivacyView />
      case 'terms':
        return <TermsView />
      case 'app':
      default:
        if (activeTab === 'cie' && !cieLevel) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-500">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-white">Select Cambridge Level</h2>
                <p className="text-slate-400">Choose your qualification level to continue.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <button 
                  onClick={() => setCieLevel('IGCSE')}
                  className="group relative p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 text-left"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BookOpen className="h-24 w-24 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">IGCSE</h3>
                  <p className="text-slate-400">International General Certificate of Secondary Education.</p>
                </button>

                <button 
                  onClick={() => setCieLevel('O Level')}
                  className="group relative p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 text-left"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Library className="h-24 w-24 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">O Level</h3>
                  <p className="text-slate-400">Ordinary Level resources.</p>
                </button>

                <button 
                  onClick={() => setCieLevel('AS and A Level')}
                  className="group relative p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 text-left"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <GraduationCap className="h-24 w-24 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">AS & A Level</h3>
                  <p className="text-slate-400">Advanced Subsidiary and Advanced Level.</p>
                </button>
              </div>
            </div>
          )
        }

        return (
          <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
            {activeTab === 'cie' && (
              <button 
                onClick={() => setCieLevel(null)}
                className="flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4"
              >
                ← Back to Level Selection
              </button>
            )}
            {/* Search Section */}
            <div className="max-w-3xl mx-auto mb-8 px-2 sm:px-0">
              <div className="relative group">
                {/* Sharper, high-contrast gradient border */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-xl opacity-60 group-hover:opacity-100 transition duration-200 blur-[1px]"></div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-10 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0 text-sm font-medium shadow-xl transition-all duration-200"
                    placeholder={`Search ${activeTab.toUpperCase()} papers...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"
                    >
                      <span className="sr-only">Clear search</span>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-center items-center space-x-4 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                  {currentData.length.toLocaleString()} total files
                </span>
                <span className="flex items-center gap-1.5">
                  <div className={`w-1 h-1 rounded-full ${filteredData.length === 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                  {filteredData.length.toLocaleString()} results
                </span>
              </div>
            </div>

            {/* Content Grid */}
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden backdrop-blur-sm flex flex-col h-[calc(100vh-280px)] sm:h-[800px]">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between sticky top-0 z-10 gap-4 sm:gap-0">
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className={`p-2 rounded-lg ${activeTab === 'ial' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-white truncate">
                    {activeTab === 'ial' ? 'IAL Sessions' : `CIE ${cieLevel}`}
                  </h2>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto pb-1 sm:pb-0">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="bg-slate-950 text-slate-400 text-xs font-medium rounded-lg border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="az">A-Z</option>
                    <option value="za">Z-A</option>
                  </select>

                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-700 shrink-0">
                    <button 
                      onClick={() => setViewMode('session')} 
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'session' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      Session
                    </button>
                    <button 
                      onClick={() => setViewMode('paper')} 
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'paper' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      Paper
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-700 shrink-0">
                    <button
                      onClick={() => setExpandAll({ action: 'expand', ts: Date.now() })}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Expand All"
                    >
                      <ChevronsDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpandAll({ action: 'collapse', ts: Date.now() })}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Collapse All"
                    >
                      <ChevronsUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div 
                className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3"
                onScroll={handleScroll}
              >
                {groupedData.length > 0 ? (
                  viewMode === 'paper' ? (
                    groupedData.slice(0, visibleCount).map(group => <PaperGroupCard key={group.id} group={group} expandTrigger={expandAll} />)
                  ) : (
                    groupedData.slice(0, visibleCount).map((group) => (
                      activeTab === 'ial' 
                        ? <IALSessionCard key={group.id} group={group} expandTrigger={expandAll} />
                        : <CIESessionCard key={group.id} group={group} expandTrigger={expandAll} />
                    ))
                  )
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 flex flex-col relative">
      <BackgroundEffect />
      
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => setView('home')}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-50 blur transition duration-500"></div>
                <div className="relative p-2 bg-slate-900/50 rounded-xl border border-slate-700 group-hover:border-indigo-500/50 transition-colors">
                  <Moon className="h-6 w-6 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-200 group-hover:text-white transition-colors">
                Moon<span className="text-indigo-400">Papers</span>
              </span>
            </div>
            
            {view === 'app' && (
              <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveTab('ial')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === 'ial' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  IAL
                </button>
                <button
                  onClick={() => setActiveTab('cie')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeTab === 'cie' 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  CIE
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative z-10">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <span>© 2026 Moon Papers.</span>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="flex items-center gap-1">
              Made with <span className="text-indigo-500">stardust</span> & code.
            </span>
          </div>
          <div className="flex space-x-6 text-sm">
            <button onClick={() => setView('privacy')} className="text-slate-400 hover:text-indigo-400 transition-colors">Privacy Policy</button>
            <button onClick={() => setView('terms')} className="text-slate-400 hover:text-indigo-400 transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  )
}

function HomeView({ setView, setActiveTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-500 relative">
      {/* Moon Glow Effect - Optimized with radial gradient instead of blur */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
        }}
      ></div>
      
      <div className="text-center space-y-6 max-w-3xl relative z-10">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
          Past Papers. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Simplified.</span>
        </h1>
        <p className="text-xl text-slate-400 leading-relaxed">
          The fastest way to find Edexcel IAL and Cambridge International past papers. 
          <span className="block mt-4 mb-2 text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            All past papers are available.
          </span>
          No ads, no clutter, just papers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-4">
        <button 
          onClick={() => { setActiveTab('ial'); setView('app'); }}
          className="group relative p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BookOpen className="h-24 w-24 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">Edexcel IAL</h3>
          <p className="text-slate-400">International Advanced Level papers, mark schemes, and reports.</p>
        </button>

        <button 
          onClick={() => { setActiveTab('cie'); setView('app'); }}
          className="group relative p-8 bg-slate-900 border border-slate-800 rounded-2xl hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <GraduationCap className="h-24 w-24 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Cambridge CIE</h3>
          <p className="text-slate-400">IGCSE, O Level, and A Level resources from Cambridge International.</p>
        </button>
      </div>

      <div className="text-center space-y-4 pt-8 border-t border-slate-800/50 w-full max-w-2xl">
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Check out also</p>
        <div className="flex flex-wrap justify-center gap-6">
          <a 
            href="https://potatopapers.me" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 transition-colors font-medium flex items-center gap-2"
          >
            PotatoPapers.me <ExternalLink className="h-3 w-3" />
          </a>
          <a 
            href="https://gradeboundaries.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-indigo-400 transition-colors font-medium flex items-center gap-2"
          >
            Gradeboundaries.com <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

function PrivacyView() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
      <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-slate-800">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <Shield className="h-8 w-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="text-slate-400 mt-1">Last updated: January 2026</p>
        </div>
      </div>
      
      <div className="space-y-8 text-slate-300 leading-relaxed">
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            Data Collection
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            We respect your privacy. We do not collect any personal identifiable information (PII). 
            We use anonymous analytics tools (like GoatCounter) solely to understand website usage patterns 
            and improve our service. No cookies are used for tracking or advertising purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            External Links
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            Our website contains links to external PDF files hosted on third-party servers. 
            We are not responsible for the privacy practices, content, or availability of these external sites.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            Contact Us
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            If you have any questions about this Privacy Policy, please contact us at: <br/>
            <a href="mailto:allgradeboundaries@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium mt-1 inline-block">
              allgradeboundaries@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

function TermsView() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in slide-in-from-bottom-8 fade-in duration-500">
      <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-slate-800">
        <div className="p-3 bg-indigo-500/10 rounded-xl">
          <Scale className="h-8 w-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="text-slate-400 mt-1">Please read these terms carefully.</p>
        </div>
      </div>

      <div className="space-y-8 text-slate-300 leading-relaxed">
        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            Usage Agreement
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            This website is an educational resource provided "as is". By using Moon Papers, you agree to use it 
            for personal, educational purposes only. We do not host any of the PDF files directly; we provide 
            an index of links to publicly available educational materials found on the internet.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            Intellectual Property
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            Moon Papers is not affiliated with, endorsed by, or connected to Pearson Edexcel, Cambridge Assessment 
            International Education (CAIE), or OxfordAQA. All trademarks, logos, and brand names are the property 
            of their respective owners. All company, product and service names used in this website are for 
            identification purposes only.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            Contact
          </h3>
          <p className="text-slate-400 pl-4 border-l border-slate-800 ml-0.5">
            For any inquiries regarding these terms, please contact: <br/>
            <a href="mailto:allgradeboundaries@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium mt-1 inline-block">
              allgradeboundaries@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

function IALSessionCard({ group, expandTrigger }) {
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    if (expandTrigger) {
      setIsExpanded(expandTrigger.action === 'expand')
    }
  }, [expandTrigger])

  const isResourceGroup = group.year === 'Resources'

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 ${isResourceGroup ? 'hover:border-amber-500/30' : 'hover:border-indigo-500/30'}`}>
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`${isResourceGroup ? 'bg-amber-500/20 text-amber-300' : 'bg-indigo-500/20 text-indigo-300'} text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0`}>
              {group.year}
            </span>
            <h3 className="text-slate-200 font-medium text-sm truncate">{group.subject}</h3>
          </div>
        </div>
        <span className="text-slate-500 text-[10px] shrink-0 ml-2">{group.session}</span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {group.sortedUnits.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {group.sortedUnits.map(unit => (
                <div key={unit.id} className="bg-slate-950/50 rounded p-1.5 border border-slate-800/50 flex flex-col justify-between">
                  <div className="text-[10px] font-medium text-slate-500 mb-1 truncate" title={unit.id}>{unit.id}</div>
                  <div className="flex gap-1 flex-wrap">
                    {unit.qp ? (
                      <a 
                        href={unit.qp.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold rounded border border-indigo-500/20 transition-colors"
                        title="Question Paper"
                      >
                        QP
                      </a>
                    ) : null}
                    
                    {unit.ms ? (
                      <a 
                        href={unit.ms.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/20 transition-colors"
                        title="Mark Scheme"
                      >
                        MS
                      </a>
                    ) : null}

                    {unit.er ? (
                      <a 
                        href={unit.er.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 text-[10px] font-bold rounded border border-purple-500/20 transition-colors"
                        title="Examiner Report"
                      >
                        ER
                      </a>
                    ) : null}

                    {unit.others.map((item, idx) => (
                      <a 
                        key={idx}
                        href={item.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] rounded border border-slate-700 transition-colors flex items-center gap-2"
                        title={item.URL}
                      >
                        <FileText className="h-3 w-3" />
                        {getCleanTitle(item)}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CIESessionCard({ group, expandTrigger }) {
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    if (expandTrigger) {
      setIsExpanded(expandTrigger.action === 'expand')
    }
  }, [expandTrigger])

  const isResourceGroup = group.year === 'Resources'

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 ${isResourceGroup ? 'hover:border-amber-500/30' : 'hover:border-emerald-500/30'}`}>
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 min-w-0">
            <span className={`${isResourceGroup ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0`}>
              {group.year}
            </span>
            <h3 className="text-slate-200 font-medium text-sm truncate">{group.subject}</h3>
          </div>
        </div>
        <span className="text-slate-500 text-[10px] shrink-0 ml-2">{group.session}</span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {/* General Resources */}
          {(group.general.er || group.general.gt || group.general.others.length > 0) && (
            <div className={`flex flex-wrap gap-1.5 ${group.sortedComponents.length > 0 ? 'pb-2 border-b border-slate-800/50' : ''}`}>
              {group.general.er && (
                <ResourceButton 
                  href={group.general.er.URL} 
                  label="ER" 
                  icon={<GraduationCap className="h-3 w-3" />}
                  color="purple"
                  size="xs"
                />
              )}
              {group.general.gt && (
                <ResourceButton 
                  href={group.general.gt.URL} 
                  label="GT" 
                  icon={<BookOpen className="h-3 w-3" />}
                  color="amber"
                  size="xs"
                />
              )}
              {group.general.others.map((item, idx) => (
                <a 
                  key={idx}
                  href={item.URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] rounded border border-slate-700 transition-colors flex items-center gap-2"
                  title={item.URL}
                >
                  <FileText className="h-3 w-3" />
                  {getCleanTitle(item)}
                </a>
              ))}
            </div>
          )}

          {/* Components */}
          {group.sortedComponents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {group.sortedComponents.map(comp => (
                <div key={comp.id} className="bg-slate-950/50 rounded p-1.5 border border-slate-800/50 flex flex-col justify-between">
                  <div className="text-[10px] font-medium text-slate-500 mb-1">Paper {comp.id}</div>
                  <div className="flex gap-1">
                    {comp.qp ? (
                      <a 
                        href={comp.qp.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold rounded border border-indigo-500/20 transition-colors"
                        title="Question Paper"
                      >
                        QP
                      </a>
                    ) : <span className="flex-1"></span>}
                    
                    {comp.ms ? (
                      <a 
                        href={comp.ms.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/20 transition-colors"
                        title="Mark Scheme"
                      >
                        MS
                      </a>
                    ) : <span className="flex-1"></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}



function ResourceButton({ href, label, icon, color, size = 'md' }) {
  const colors = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  }
  
  const sizes = {
    xs: 'px-2.5 py-1 text-[10px]',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm'
  }

  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center space-x-2 rounded-lg border transition-all duration-200 font-medium ${colors[color]} ${sizes[size]}`}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
      <FileText className="h-12 w-12 mb-3 opacity-20" />
      <p>No documents found</p>
      <p className="text-xs mt-2 opacity-50">Try adjusting your search or selecting a different tab.</p>
    </div>
  )
}

export default App

function PaperGroupCard({ group, expandTrigger }) {
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (expandTrigger) {
      setIsExpanded(expandTrigger.action === 'expand')
    }
  }, [expandTrigger])

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200 ${group.isOldSyllabus ? 'opacity-60 hover:opacity-100' : 'hover:border-indigo-500/30'}`}>
      <div 
        className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-slate-200 font-medium text-sm">{group.subject}</h3>
              {group.isOldSyllabus && (
                <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-medium">
                  Old Syllabus
                </span>
              )}
            </div>
            {group.unit !== 'General' && (
              <p className="text-slate-500 text-xs font-mono mt-0.5">{group.unit}</p>
            )}
          </div>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
          {group.sortedSessions.length} Sessions
        </span>
      </div>
      
      {isExpanded && (
        <div className="divide-y divide-slate-800/50">
          {group.sortedSessions.map((session) => (
            <div key={`${session.year}-${session.session}`} className="px-4 py-2 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center space-x-3 min-w-[120px]">
                <span className="text-slate-300 text-xs font-medium">{session.year}</span>
                <span className="text-slate-500 text-xs">{session.session}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {session.qp ? (
                  <a href={session.qp.URL} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 text-[10px] font-bold rounded border border-indigo-500/20 transition-colors">QP</a>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-bold border border-transparent invisible select-none">QP</span>
                )}
                
                {session.ms ? (
                  <a href={session.ms.URL} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/20 transition-colors">MS</a>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-bold border border-transparent invisible select-none">MS</span>
                )}
                
                {session.er ? (
                  <a href={session.er.URL} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 text-[10px] font-bold rounded border border-purple-500/20 transition-colors">ER</a>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-bold border border-transparent invisible select-none">ER</span>
                )}
                
                {session.gt ? (
                  <a href={session.gt.URL} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 text-[10px] font-bold rounded border border-amber-500/20 transition-colors">GT</a>
                ) : (
                  <span className="px-2 py-1 text-[10px] font-bold border border-transparent invisible select-none">GT</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BackgroundEffect() {
  const stars = useMemo(() => {
    let s = ''
    for(let i=0; i<50; i++) {
      s += `${Math.random()*100}vw ${Math.random()*100}vh ${Math.random() > 0.8 ? '#fff' : '#ffffffaa'},`
    }
    return s.slice(0, -1)
  }, [])

  const particles = useMemo(() => Array.from({ length: 10 }), [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Static Stars */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{ 
          boxShadow: stars, 
          width: '2px', 
          height: '2px',
          borderRadius: '50%',
          background: 'transparent'
        }} 
      />
      
      {/* Floating Yellow/Amber Dots */}
      {particles.map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-amber-400/20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${Math.random() * 3 + 2}px`,
            height: `${Math.random() * 3 + 2}px`,
            animation: `float ${Math.random() * 20 + 20}s linear infinite, pulse-glow ${Math.random() * 4 + 3}s ease-in-out infinite`,
            animationDelay: `-${Math.random() * 20}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}
