import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/api'
import { can } from '../navigation'
import { AddonsPanel } from './addons-panel'
import { ProductsPanel } from './products-panel'

type Tab = 'produtos' | 'adicionais'

export function MenuPage() {
  const { data: me } = useSession()
  const manage = Boolean(me && can(me, 'MENU_MANAGE'))
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('aba') === 'adicionais' ? 'adicionais' : 'produtos'

  const changeTab = (next: string) => {
    const copy = new URLSearchParams(params)
    if (next === 'adicionais') copy.set('aba', 'adicionais')
    else copy.delete('aba')
    setParams(copy, { replace: true })
  }

  return (
    <>
      <PageHeader
        eyebrow="Cardápio"
        title="Produtos e adicionais"
        description="O que o cliente pode pedir pela plaquinha. Preços finais são sempre recalculados pelo servidor no pedido."
      />
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList aria-label="Seções do cardápio">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais e variações</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-6 focus-visible:outline-none">
          <ProductsPanel manage={manage} />
        </TabsContent>
        <TabsContent value="adicionais" className="mt-6 focus-visible:outline-none">
          <AddonsPanel manage={manage} />
        </TabsContent>
      </Tabs>
    </>
  )
}
