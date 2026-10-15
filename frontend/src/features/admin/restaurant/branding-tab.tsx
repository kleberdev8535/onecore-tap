import { useState } from 'react'
import { toast } from 'sonner'
import { MenuPreview } from '@/components/brand/menu-preview'
import { ColorField, ContrastNotice } from '@/components/color-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useUpdateBranding } from '@/features/admin/management-api'
import { FormAlert } from '@/features/auth/form-alert'
import { ApiError } from '@/services/http'
import type { RestaurantDetail } from '@/types/api'
import { isHexColor } from '@/utils/color'

export function BrandingTab({ restaurant: r }: { restaurant: RestaurantDetail }) {
  const save = useUpdateBranding(r.id)
  const [primary, setPrimary] = useState(r.primaryColor)
  const [accent, setAccent] = useState(r.accentColor)
  const [logoUrl, setLogoUrl] = useState(r.logoUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  const primaryOk = isHexColor(primary)
  const accentOk = isHexColor(accent)
  const logoOk = logoUrl === '' || /^https:\/\/\S+$/.test(logoUrl)
  const p = primaryOk ? primary : '#16A36B'
  const a = accentOk ? accent : '#0B0F0E'

  const submit = async () => {
    if (!primaryOk || !accentOk || !logoOk) return
    setError(null)
    try {
      await save.mutateAsync({ primaryColor: primary, accentColor: accent, logoUrl: logoUrl || undefined })
      toast.success('Identidade visual salva.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader><div><CardTitle>Marca do restaurante</CardTitle><CardDescription>Aplicada ao cardápio que o cliente abre pela plaquinha.</CardDescription></div></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FormAlert message={error} />
          <ColorField label="Cor principal" hint="Botões, destaques e preço." value={primary} onChange={setPrimary} valid={primaryOk} />
          <ColorField label="Cor de apoio" hint="Cabeçalho e fundo da capa." value={accent} onChange={setAccent} valid={accentOk} />
          <Field label="URL do logotipo" hint="Endereço https de uma imagem quadrada (PNG ou SVG). O upload direto chega com o armazenamento de imagens." error={!logoOk ? 'Use um endereço https://' : undefined}>
            <Input type="url" placeholder="https://..." value={logoUrl} onChange={(e) => setLogoUrl(e.target.value.trim())} />
          </Field>
          <ContrastNotice color={p} />
          <div className="flex justify-end">
            <Button onClick={submit} loading={save.isPending} disabled={!primaryOk || !accentOk || !logoOk}>Salvar identidade</Button>
          </div>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-[13px] font-medium text-fg-secondary">Prévia no celular</p>
        <MenuPreview tradeName={r.tradeName} primaryColor={p} accentColor={a} logoUrl={logoOk ? logoUrl : undefined} />
      </div>
    </div>
  )
}
