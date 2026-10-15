import { CopyField } from '@/components/copy-field'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

export function InviteLinkDialog({ link, name, onClose }: { link: string | null; name: string; onClose: () => void }) {
  return (
    <Dialog
      open={link !== null}
      onOpenChange={(o) => !o && onClose()}
      title={`Convite de ${name}`}
      description="Envie este link para a pessoa criar a senha. Ele vale por 72 horas e pode ser usado uma única vez."
      footer={<Button onClick={onClose}>Concluir</Button>}
    >
      {link && <CopyField value={link} label="Link de convite" />}
      <p className="mt-4 rounded-lg border border-warning/20 bg-warning-soft px-3.5 py-3 text-[13px] leading-relaxed text-warning">
        O envio automático por e-mail ainda não está configurado. Compartilhe o link por um canal seguro (ex.: WhatsApp do proprietário).
      </p>
    </Dialog>
  )
}
