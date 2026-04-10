'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { GNB } from '@/components/GNB'
import { Button, Input, Field, Toast, Spinner } from '@/components/ui'
import type { CompanySettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import Link from 'next/link'
import Image from 'next/image'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import type { PlanType } from '@/lib/plans'

const DAUM_POSTCODE_SCRIPT = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

/** 다음(카카오) 우편번호 API 로드 후 주소 검색 팝업 열기 */
function openDaumPostcode(onComplete: (address: string) => void, onError: (message: string) => void) {
  const run = () => {
    const w = window as unknown as {
      kakao?: {
        Postcode: new (opts: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void }
      }
    }
    const kakao = w.kakao
    if (!kakao?.Postcode) {
      onError('주소 검색 서비스를 불러올 수 없습니다. 직접 입력해주세요.')
      return
    }
    new kakao.Postcode({
      oncomplete(data: DaumPostcodeData) {
        let addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
        let extra = ''
        if (data.userSelectedType === 'R') {
          if (data.bname && /[동로가]$/.test(data.bname)) extra += data.bname
          if (data.buildingName && data.apartment === 'Y') extra += (extra ? ', ' + data.buildingName : data.buildingName)
          if (extra) extra = ' (' + extra + ')'
        }
        const full = (addr || '') + extra
        onComplete(full.trim())
      },
    }).open()
  }
  const hasPostcode = (window as any)?.kakao?.Postcode
  if (hasPostcode) {
    run()
    return
  }
  const script = document.createElement('script')
  script.src = DAUM_POSTCODE_SCRIPT
  script.async = true
  script.onload = run
  script.onerror = () => onError('주소 검색 서비스를 불러올 수 없습니다. 직접 입력해주세요.')
  document.head.appendChild(script)
}

interface DaumPostcodeData {
  userSelectedType: 'R' | 'J'
  roadAddress: string
  jibunAddress: string
  bname?: string
  buildingName?: string
  apartment?: string
}

/** 사업자번호 숫자만 추출 후 자동 하이픈 (000-00-00000) */
function formatBizNo(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

/** 전화번호 숫자만 추출 후 자동 하이픈 (한국 형식) */
function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.startsWith('02')) {
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return digits.length === 9
      ? `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
      : `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.startsWith('01')) {
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function SettingsPage() {
  const [cfg,  setCfg]  = useState<CompanySettings>(DEFAULT_SETTINGS)
  const [toast, setToast] = useState('')
  const [postcodeError, setPostcodeError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [me, setMe] = useState<{ subscription: { planType: PlanType }; usage: { companyProfileCount: number }; limits: { companyProfileLimit: number } } | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const showToast = useCallback((m: string) => {
    setToast(m); setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => {
    apiFetch<CompanySettings>('/api/settings')
      .then(setCfg)
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch<{ subscription: { planType: PlanType }; usage: { companyProfileCount: number }; limits: { companyProfileLimit: number } }>('/api/me')
      .then(setMe)
      .catch(() => {})
  }, [])

  async function saveCfg(nextCfg?: CompanySettings, successMessage = '설정 저장 완료!') {
    try {
      const payload = nextCfg ?? cfg
      await apiFetch<null>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      showToast(successMessage)
      apiFetch<{ subscription: { planType: PlanType }; usage: { companyProfileCount: number }; limits: { companyProfileLimit: number } }>('/api/me')
        .then(setMe)
        .catch(() => {})
    } catch (e) {
      showToast(toUserMessage(e, '설정 저장에 실패했습니다.'))
    }
  }

  const set = (k: keyof CompanySettings) => (v: string | number) =>
    setCfg(c => ({ ...c, [k]: v }))
  const setBank = (k: 'bankName' | 'accountNumber' | 'accountHolder') => (v: string) =>
    setCfg(c => ({
      ...c,
      bankAccount: {
        bankName: c.bankAccount?.bankName || '',
        accountNumber: c.bankAccount?.accountNumber || '',
        accountHolder: c.bankAccount?.accountHolder || '',
        [k]: v,
      },
    }))

  async function uploadLogo(file: File) {
    try {
      setLogoUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      const uploaded = await apiFetch<{ logoUrl: string }>('/api/settings/logo', {
        method: 'POST',
        body: formData,
      })
      const nextCfg = { ...cfg, logoUrl: uploaded.logoUrl }
      setCfg(nextCfg)
      await saveCfg(nextCfg, '로고 업로드 및 저장 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '로고 업로드에 실패했습니다.'))
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function deleteLogo() {
    const nextCfg = { ...cfg, logoUrl: null }
    setCfg(nextCfg)
    await saveCfg(nextCfg, '로고 삭제 및 저장 완료!')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">설정</h1>
            <p className="text-xs text-gray-500 mt-0.5">회사 정보와 견적 기본값</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => void saveCfg()}>저장</Button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
          {me?.subscription?.planType === 'FREE' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              무료 플랜은 기업정보를 {me.limits.companyProfileLimit}개까지 저장할 수 있어요. (현재 {me.usage.companyProfileCount}개)
              <Link href="/plans" className="ml-2 font-semibold underline">업그레이드 →</Link>
            </div>
          )}

          <section className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-card">
            <div className="px-4 py-3 bg-primary-50/50 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">회사 정보</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <Field label="상호명">
                <Input value={cfg.name} onChange={e => set('name')(e.target.value)} placeholder="(주)이벤트플러스" />
              </Field>
              <Field label="사업자번호">
                <Input value={cfg.biz} onChange={e => set('biz')(formatBizNo(e.target.value))} placeholder="000-00-00000" />
              </Field>
              <Field label="대표자">
                <Input value={cfg.ceo} onChange={e => set('ceo')(e.target.value)} placeholder="홍길동" />
              </Field>
              <Field label="담당자">
                <Input value={cfg.contact} onChange={e => set('contact')(e.target.value)} placeholder="김담당" />
              </Field>
              <Field label="담당자 연락처">
                <Input value={cfg.tel} onChange={e => set('tel')(formatPhoneDisplay(e.target.value))} placeholder="010-0000-0000" />
              </Field>
              <Field label="주소">
                <div className="flex gap-2">
                  <Input
                    value={cfg.addr}
                    onChange={e => set('addr')(e.target.value)}
                    placeholder="주소 찾기로 검색하세요"
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-shrink-0 whitespace-nowrap"
                    onClick={() =>
                      openDaumPostcode(
                        (addr) => {
                          setPostcodeError('')
                          set('addr')(addr)
                        },
                        (message) => setPostcodeError(message),
                      )
                    }
                  >
                    주소 찾기
                  </Button>
                </div>
                {postcodeError && <p className="mt-2 text-xs text-red-600">{postcodeError}</p>}
              </Field>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-card">
            <div className="px-4 py-3 bg-primary-50/50 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">브랜드/연락/정산 정보</h2>
            </div>
            <div className="p-4 space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">회사 로고</p>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  {cfg.logoUrl ? (
                    <Image
                      src={cfg.logoUrl}
                      alt="회사 로고"
                      width={240}
                      height={80}
                      className="h-20 w-auto object-contain rounded bg-white border border-slate-200 p-2"
                    />
                  ) : (
                    <p className="text-sm text-slate-500">로고 없음</p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void uploadLogo(file)
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    파일 선택
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={logoUploading || !cfg.logoUrl}
                    onClick={deleteLogo}
                  >
                    로고 삭제
                  </Button>
                  {logoUploading && <Spinner label="업로드 중..." />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="이메일">
                  <Input
                    type="email"
                    value={cfg.email || ''}
                    onChange={e => setCfg(c => ({ ...c, email: e.target.value }))}
                    placeholder="hello@company.com"
                  />
                </Field>
                <Field label="웹사이트">
                  <Input
                    type="url"
                    value={cfg.websiteUrl || ''}
                    onChange={e => setCfg(c => ({ ...c, websiteUrl: e.target.value }))}
                    placeholder="https://"
                  />
                </Field>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">계좌 정보</p>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    value={cfg.bankAccount?.bankName || ''}
                    onChange={e => setBank('bankName')(e.target.value)}
                    placeholder="은행명"
                  />
                  <Input
                    value={cfg.bankAccount?.accountNumber || ''}
                    onChange={e => setBank('accountNumber')(e.target.value)}
                    placeholder="계좌번호"
                  />
                  <Input
                    value={cfg.bankAccount?.accountHolder || ''}
                    onChange={e => setBank('accountHolder')(e.target.value)}
                    placeholder="예금주"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-card">
            <div className="px-4 py-3 bg-primary-50/50 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">기본 견적 설정</h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
              <Field label="제경비율 (%)">
                <Input type="number" value={cfg.expenseRate} min={0} max={100}
                  onChange={e => set('expenseRate')(+e.target.value)} />
              </Field>
              <Field label="이윤율 (%)">
                <Input type="number" value={cfg.profitRate} min={0} max={100}
                  onChange={e => set('profitRate')(+e.target.value)} />
              </Field>
              <Field label="유효기간 (일)">
                <Input type="number" value={cfg.validDays} min={1}
                  onChange={e => set('validDays')(+e.target.value)} />
              </Field>
              <div className="col-span-3">
                <Field label="결제 조건 기본값">
                  <textarea
                    value={cfg.paymentTerms}
                    onChange={e => set('paymentTerms')(e.target.value)}
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 resize-none focus:outline-none focus:border-gray-400"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-card">
            <div className="px-4 py-3 bg-primary-50/50 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">참고 견적서 학습</h2>
              <p className="text-xs text-gray-400 mt-0.5">견적서 파일을 올리면 인공지능이 구성·단가를 학습하고, 단가표에 자동 반영합니다. 업로드·관리는 왼쪽 메뉴 「참고 자료」에서 하세요.</p>
              <Link href="/reference-estimate" className="inline-block mt-2 text-xs font-medium text-gray-600 hover:text-gray-900 underline">
                참고 견적서 메뉴로 이동 →
              </Link>
            </div>
          </section>

        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
