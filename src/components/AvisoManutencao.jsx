// Faixa fixa no topo avisando que o site está em manutenção (ex.: cota do servidor esgotada)
export default function AvisoManutencao({ texto = 'Estamos em manutenção. Algumas informações podem não aparecer agora — tente novamente em alguns minutos.' }) {
  return (
    <div className="bg-yellow-400 text-yellow-950 text-sm font-semibold px-4 py-2.5 flex items-center justify-center gap-2 text-center" role="status">
      <i className="fas fa-tools"></i>
      <span>{texto}</span>
    </div>
  )
}
