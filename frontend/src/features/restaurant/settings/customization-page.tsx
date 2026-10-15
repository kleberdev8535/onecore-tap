import { useState } from 'react'
import { CircleAlert, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { MenuPreview } from '@/components/brand/menu-preview'
import { ColorField, ContrastNotice } from '@/components/color-field'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { RestaurantSettings } from '@/types/api'
import { isHexColor } from '@/utils/color'
import { useRestaurantSettings, useUpdateContact, useUpdateRestaurantBranding } from '../api'
import { contactFrom } from './contact-input'
import { HoursEditor } from './hours-editor'

const httpsUrl = (v: string) => v === '' || /^https:\/\/\S+$/.test(v)

export function CustomizationPage() {
  const settings = useRestaurantSettings()
  return (
    <>
      <PageHeader eyebrow="Estabelecimento" title="Personalização" description="Como o restaurante aparece no cardápio que o cliente abre pela plaquinha." />
      {settings.isPending && <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" aria-busy><Skeleton className="h-[520px] rounded-xl" /><Skeleton className="h-[520px] rounded-xl" /></div>}
      {settings.isError && <Card><EmptyState icon={CircleAlert} title="Não foi possível carregar a personalização" description={settings.error.message} action={<Button variant="secondary" onClick={() => settings.refetch()}><RotateCw aria-hidden /> Tentar novamente</Button>} /></Card>}
      {settings.data && <CustomizationForm key={settings.data.id} settings={settings.data} />}
    </>
  )
}

function CustomizationForm({ settings: s }: { settings: RestaurantSettings }) {
  const branding = useUpdateRestaurantBranding()
  const contact = useUpdateContact()
  const [primary, setPrimary] = useState(s.primaryColor)
  const [accent, setAccent] = useState(s.accentColor)
  const [logoUrl, setLogoUrl] = useState(s.logoUrl ?? '')
  const [coverUrl, setCoverUrl] = useState(s.coverImageUrl ?? '')
  const [description, setDescription] = useState(s.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const primaryOk = isHexColor(primary)
  const accentOk = isHexColor(accent)
  const logoOk = httpsUrl(logoUrl)
  const coverOk = httpsUrl(coverUrl)
  const valid = primaryOk && accentOk && logoOk && coverOk && description.length <= 300
  const p = primaryOk ? primary : '#16A36B'
  const a = accentOk ? accent : '#0B0F0E'
  const saving = branding.isPending || contact.isPending

  const submit = async () => {
    if (!valid) return
    setError(null)
    try {
      await branding.mutateAsync({ primaryColor: primary, accentColor: accent, logoUrl: logoUrl || undefined, coverImageUrl: coverUrl || undefined })
      if ((s.description ?? '') !== description.trim()) {
        await contact.mutateAsync(contactFrom(s, { description: description.trim() }))
      }
      toast.success('Personalização salva.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader><div><CardTitle>Marca e apresentação</CardTitle><CardDescription>Cores, logotipo, capa e uma descrição curta.</CardDescription></div></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <FormAlert message={error} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ColorField label="Cor principal" hint="Botões, destaques e preço." value={primary} onChange={setPrimary} valid={primaryOk} />
              <ColorField label="Cor de apoio" hint="Cabeçalho e véu sobre a capa." value={accent} onChange={setAccent} valid={accentOk} />
            </div>
            <ContrastNotice color={p} />
            <Field label="URL do logotipo" hint="Imagem quadrada em https (PNG ou SVG)." error={logoOk ? undefined : 'Use um endereço https://'}>
              <Input type="url" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value.trim())} />
            </Field>
            <Field label="URL da imagem de capa" hint="Foto horizontal em https. Recebe um véu na cor de apoio para manter o nome legível." error={coverOk ? undefined : 'Use um endereço https://'}>
              <Input type="url" placeholder="https://..." value={coverUrl} onChange={(e) => setCoverUrl(e.target.value.trim())} />
            </Field>
            <Field label="Descrição" hint={`${description.length}/300 · Aparece abaixo do nome no cardápio.`} error={description.length > 300 ? 'Use até 300 caracteres' : undefined}>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hambúrgueres artesanais na brasa desde 2015." />
            </Field>
            <p className="text-xs text-muted">O upload direto de imagens chega com o armazenamento de imagens; por enquanto use endereços https públicos.</p>
            <div className="flex justify-end">
              <Button onClick={submit} loading={saving} disabled={!valid}>Salvar personalização</Button>
            </div>
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[13px] font-medium text-fg-secondary">Prévia no celular</p>
          <MenuPreview tradeName={s.tradeName} primaryColor={p} accentColor={a} logoUrl={logoOk ? logoUrl : undefined} coverImageUrl={coverOk ? coverUrl : undefined} description={description.trim() || undefined} />
        </div>
      </div>
      <HoursEditor hours={s.openingHours} />
    </div>
  )
}
