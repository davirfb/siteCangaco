#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para gerar o HTML dos produtos a partir do arquivo JSON
Gera apenas a seção de produtos e modais, que pode ser inserida no produtos.html
"""

import json
import os
from urllib.parse.quote


def carregar_produtos(arquivo_json: str = "produtos.json") -> dict:
    """Carrega os produtos do arquivo JSON"""
    if not os.path.exists(arquivo_json):
        print(f"Erro: Arquivo {arquivo_json} não encontrado.")
        return {"produtos": []}
    
    try:
        with open(arquivo_json, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        print(f"Erro: O arquivo {arquivo_json} está corrompido.")
        return {"produtos": []}


def gerar_html_produtos(produtos: list) -> str:
    """Gera o HTML da seção de produtos"""
    html = '            <div class="produtos-grid-full">\n'
    
    for produto in produtos:
        html += f'                <!-- Produto {produto["id"]} -->\n'
        html += '                <div class="produto-card-full">\n'
        html += f'                    <img src="{produto["imagem"]}" alt="{produto["alt"]}">\n'
        html += '                    <div class="produto-info">\n'
        html += f'                        <h3>{produto["titulo"]}</h3>\n'
        
        if produto.get("descricao"):
            html += f'                        <p class="produto-desc">{produto["descricao"]}</p>\n'
        else:
            html += '                        <p class="produto-desc"></p>\n'
        
        html += f'                        <p class="produto-preco">{produto["preco"]}</p>\n'
        html += f'                        <button class="btn-secondary" onclick="abrirModal(\'{produto["modal"]["id"]}\')">Ver Fardo</button>\n'
        html += '                    </div>\n'
        html += '                </div>\n\n'
    
    html += '            </div>\n'
    return html


def gerar_html_modais(produtos: list) -> str:
    """Gera o HTML dos modais"""
    html = '    <!-- Modais -->\n'
    
    for produto in produtos:
        modal = produto["modal"]
        whatsapp_texto_encoded = quote(modal["whatsapp_texto"])
        whatsapp_url = f"https://wa.me/{modal['whatsapp_numero']}?text={whatsapp_texto_encoded}"
        
        html += f'    <!-- Modal {produto["id"]} -->\n'
        html += f'    <div id="{modal["id"]}" class="modal">\n'
        html += '        <div class="modal-content">\n'
        html += f'            <span class="modal-close" onclick="fecharModal(\'{modal["id"]}\')">&times;</span>\n'
        html += f'            <img src="{modal["imagem"]}" alt="{modal["alt"]}">\n'
        html += f'            <h2>{modal["titulo"]}</h2>\n'
        html += f'            <p class="modal-desc">{modal["descricao"]}</p>\n'
        html += f'            <p class="modal-preco">{modal["preco"]}</p>\n'
        html += f'            <a href="{whatsapp_url}" class="btn-primary" target="_blank">Comprar via WhatsApp</a>\n'
        html += '        </div>\n'
        html += '    </div>\n\n'
    
    return html


def main():
    """Função principal"""
    print("="*60)
    print("GERADOR DE HTML PARA PRODUTOS")
    print("="*60)
    
    # Carregar produtos
    dados = carregar_produtos()
    produtos = dados.get("produtos", [])
    
    if not produtos:
        print("Nenhum produto encontrado no arquivo JSON.")
        return
    
    # Gerar HTML
    html_produtos = gerar_html_produtos(produtos)
    html_modais = gerar_html_modais(produtos)
    
    # Salvar em arquivo
    arquivo_saida = "produtos_html_gerado.txt"
    with open(arquivo_saida, 'w', encoding='utf-8') as f:
        f.write("="*60 + "\n")
        f.write("SEÇÃO DE PRODUTOS (substituir no produtos.html)\n")
        f.write("="*60 + "\n\n")
        f.write(html_produtos)
        f.write("\n\n")
        f.write("="*60 + "\n")
        f.write("SEÇÃO DE MODAIS (substituir no produtos.html)\n")
        f.write("="*60 + "\n\n")
        f.write(html_modais)
    
    print(f"\n✓ HTML gerado com sucesso!")
    print(f"✓ Arquivo salvo em: {arquivo_saida}")
    print(f"\nTotal de produtos: {len(produtos)}")
    print("\nVocê pode copiar o conteúdo do arquivo e colar no produtos.html")


if __name__ == "__main__":
    main()
