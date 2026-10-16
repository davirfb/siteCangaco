// Produto aparece no site público se estiver ativo no Catálogo e marcado na página Site.
// Produtos antigos (sem o campo exibirNoSite) continuam aparecendo.
export function visivelNoSite(p) {
  return p.ativo !== false && p.exibirNoSite !== false
}
