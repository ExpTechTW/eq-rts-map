'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { open } from '@tauri-apps/plugin-dialog'
import { join, resourceDir } from '@tauri-apps/api/path'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { FolderOpen, HardDrive, BarChart3, Shield, Eye, Layers, ArrowLeft } from 'lucide-react'
import { StatsDisplay } from '@/components/StatsDisplay'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/LanguageSwitcher'

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-card/60 backdrop-blur-md rounded-lg border border-border/50 p-3 flex items-center gap-3 hover:bg-card/80 hover:border-primary/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative z-10 w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300 shadow-sm">
        <div className="w-4 h-4 flex items-center justify-center text-primary transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // 縮短路徑顯示 - 智能省略，保留開頭和最後兩個資料夾
  const getDisplayPath = (path: string) => {
    const maxLength = 50
    if (path.length <= maxLength) return path

    const parts = path.split('/').filter(p => p.length > 0) // 過濾空字串
    if (parts.length <= 3) return path

    // 保留第一個部分和最後兩個部分
    const firstPart = parts[0]
    const lastTwo = parts.slice(-2)

    // 計算省略了多少層
    const omittedCount = parts.length - 3

    // Windows 路徑 (例如 C:) 或 Unix 路徑 (例如 Users)
    const prefix = path.startsWith('/') ? '/' : ''

    return `${prefix}${firstPart}/...(${omittedCount})/${lastTwo.join('/')}`
  }

  // Feature data
  const features = [
    { icon: <Eye className="w-3 h-3 text-primary" />, title: t('home.features.visualization'), description: t('home.features.visualizationDesc') },
    { icon: <Layers className="w-3 h-3 text-primary" />, title: t('home.features.hierarchy'), description: t('home.features.hierarchyDesc') },
    { icon: <Shield className="w-3 h-3 text-primary" />, title: t('home.features.security'), description: t('home.features.securityDesc') }
  ]

  // Mouse tracking for cursor glow effect
  useEffect(() => {
    let animationFrame: number

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY })
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [])

  // Audio playback helper (Tauri only)
  const playAudio = async (audioFileName: string) => {
    try {
      // Check if running in Tauri environment
      if (!isTauri()) {
        console.warn('Not in Tauri environment, skipping audio playback')
        return
      }

      const resourceDirPath = await resourceDir()
      const filePath = await join(resourceDirPath, 'audios', audioFileName)
      const assetUrl = convertFileSrc(filePath)

      const audio = new Audio(assetUrl)
      audio.volume = 0.5
      await audio.play()
    } catch (error) {
      console.error('音效載入失敗:', error)
    }
  }

  // Event handlers
  const handleSelectFolder = async () => {
    // Play audio
    playAudio('1.mp3')

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select folder to analyze',
      })
      if (selected && typeof selected === 'string') {
        setSelectedPath(selected)
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  const handleAnalyze = () => {
    if (selectedPath) {
      // Play audio
      playAudio('2.mp3')

      setIsLoading(true)
      router.push(`/analyze?path=${encodeURIComponent(selectedPath)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex items-center justify-center relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      {/* Background Tech Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-primary/5 rounded-full blur-2xl animate-pulse delay-1000"></div>
      </div>

      {/* Cursor Follow Glow - Bottom Layer */}
      <div
        className="fixed pointer-events-none z-10"
        style={{
          left: mousePosition.x - 150,
          top: mousePosition.y - 150,
          width: '300px',
          height: '300px',
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
        }}
      >
        <div className="w-full h-full bg-primary/8 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg group-hover:bg-primary/30 transition-all duration-300"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border border-primary/20 group-hover:border-primary/30 transition-all duration-300">
                <HardDrive className="w-8 h-8 text-primary group-hover:text-primary/80 transition-colors duration-300" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              {t('home.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('home.subtitle')}
            </p>
          </div>
        </div>

        {/* 卡片切換容器 */}
        <div className="relative" style={{ minHeight: '200px' }}>
          {/* Statistics & Features - 第一組 */}
          <div className={`${!selectedPath ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-75 pointer-events-none invisible'}`} style={{ transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 200px)', gap: '12px', justifyContent: 'center', gridTemplateRows: 'auto auto auto' }}>
              {/* 第 1-4 格：前 4 個統計卡片 */}
              <StatsDisplay />

              {/* 第 5 格：瀏覽資料夾按鈕（正中間） */}
              <button
                onClick={handleSelectFolder}
                className="bg-gradient-to-br from-primary/30 to-primary/15 backdrop-blur-md rounded-lg border-2 border-primary/60 p-3 flex items-center gap-3 hover:from-primary/40 hover:to-primary/20 hover:border-primary/80 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-primary/40 group relative overflow-hidden"
                style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', gridColumn: '2', gridRow: '2' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-shimmer"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative z-10 w-10 h-10 bg-gradient-to-br from-primary/40 to-primary/20 rounded-lg flex items-center justify-center group-hover:from-primary/60 group-hover:to-primary/30 transition-all duration-300 shadow-sm group-hover:scale-110">
                  <FolderOpen className="w-4 h-4 text-primary-foreground drop-shadow-lg" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{t('home.selectFolder')}</h3>
                  <p className="text-[10px] text-muted-foreground group-hover:text-foreground/80 transition-colors">{t('home.selectFolderDesc')}</p>
                </div>
              </button>

              {/* 第 6-9 格：功能卡片 */}
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </div>

          {/* 已選擇路徑卡片和按鈕 - 第二組 */}
          <div className={`absolute ${selectedPath ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-75 pointer-events-none invisible'}`} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              {selectedPath && (
                <div className="bg-card/60 backdrop-blur-md rounded-lg border border-border/50 p-3 hover:bg-card/80 hover:border-primary/30 transition-all duration-500 hover:shadow-lg group relative overflow-hidden" style={{ width: '412px' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">{t('home.selectedPath')}</h3>
                      <p className="text-[11px] text-foreground font-mono leading-relaxed truncate" title={selectedPath}>{getDisplayPath(selectedPath)}</p>
                    </div>
                    <button
                      onClick={() => setSelectedPath('')}
                      className="w-8 h-8 bg-gradient-to-br from-muted/50 to-muted/30 rounded-lg flex items-center justify-center hover:from-muted/70 hover:to-muted/50 transition-all duration-500 hover:scale-110 hover:rotate-[-8deg] border border-border/30 group/back relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover/back:opacity-100 transition-opacity duration-500"></div>
                      <ArrowLeft className="w-4 h-4 text-foreground relative z-10 transition-transform duration-500 group-hover/back:translate-x-[-2px]" />
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedPath || isLoading}
                  className="bg-gradient-to-br from-primary/30 to-primary/15 backdrop-blur-md rounded-lg border-2 border-primary/60 p-3 flex items-center gap-3 hover:from-primary/40 hover:to-primary/20 hover:border-primary/80 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-primary/40 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-muted/20 disabled:to-muted/10 disabled:border-muted/30"
                  style={{ width: '200px', animation: (!selectedPath || isLoading) ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-shimmer"></div>
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-primary/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative z-10 w-10 h-10 bg-gradient-to-br from-primary/40 to-primary/20 rounded-lg flex items-center justify-center group-hover:from-primary/60 group-hover:to-primary/30 transition-all duration-300 shadow-sm group-hover:scale-110">
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    ) : (
                      <BarChart3 className="w-4 h-4 text-primary-foreground drop-shadow-lg" />
                    )}
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {isLoading ? t('home.analyzing') : t('home.startAnalysis')}
                    </h3>
                    <p className="text-[10px] text-muted-foreground group-hover:text-foreground/80 transition-colors">
                      {isLoading ? t('home.processing') : t('home.executeScan')}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}