#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para editar produtos do site Cangaço
Permite adicionar, editar, remover e listar produtos através de um arquivo JSON
"""

import json
import os
from typing import Dict, List, Optional


class EditorProdutos:
    def __init__(self, arquivo_json: str = "produtos.json"):
        """Inicializa o editor de produtos"""
        self.arquivo_json = arquivo_json
        self.produtos = self.carregar_produtos()
    
    def carregar_produtos(self) -> Dict:
        """Carrega os produtos do arquivo JSON"""
        if os.path.exists(self.arquivo_json):
            try:
                with open(self.arquivo_json, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print(f"Erro: O arquivo {self.arquivo_json} está corrompido.")
                return {"produtos": []}
        else:
            return {"produtos": []}
    
    def salvar_produtos(self):
        """Salva os produtos no arquivo JSON"""
        with open(self.arquivo_json, 'w', encoding='utf-8') as f:
            json.dump(self.produtos, f, ensure_ascii=False, indent=2)
        print(f"✓ Produtos salvos em {self.arquivo_json}")
    
    def listar_produtos(self):
        """Lista todos os produtos"""
        produtos = self.produtos.get("produtos", [])
        if not produtos:
            print("Nenhum produto cadastrado.")
            return
        
        print("\n" + "="*60)
        print("LISTA DE PRODUTOS")
        print("="*60)
        for produto in produtos:
            print(f"\nID: {produto['id']}")
            print(f"  Título: {produto['titulo']}")
            print(f"  Preço: {produto['preco']}")
            print(f"  Descrição: {produto['descricao'] or '(sem descrição)'}")
            print(f"  Imagem: {produto['imagem']}")
        print("\n" + "="*60)
    
    def adicionar_produto(self):
        """Adiciona um novo produto"""
        print("\n--- ADICIONAR NOVO PRODUTO ---")
        
        # Encontrar o próximo ID
        produtos = self.produtos.get("produtos", [])
        proximo_id = max([p['id'] for p in produtos], default=0) + 1
        
        # Coletar informações do produto
        titulo = input("Título do produto: ").strip()
        descricao = input("Descrição (pode deixar em branco): ").strip()
        preco = input("Preço (ex: R$ 25,90): ").strip()
        imagem = input("Caminho da imagem (ex: img/logocacto.svg): ").strip()
        alt = input("Texto alternativo da imagem: ").strip()
        
        # Informações do modal
        print("\n--- Informações do Modal (Fardo) ---")
        modal_titulo = input("Título do modal: ").strip()
        modal_descricao = input("Descrição do fardo: ").strip()
        modal_preco = input("Preço do fardo (ex: R$ 280,00): ").strip()
        modal_imagem = input("Imagem do modal: ").strip()
        modal_alt = input("Texto alternativo da imagem do modal: ").strip()
        whatsapp_texto = input("Texto para WhatsApp: ").strip()
        whatsapp_numero = input("Número do WhatsApp (ex: 5511999999999): ").strip()
        
        # Criar produto
        novo_produto = {
            "id": proximo_id,
            "imagem": imagem or "img/logocacto.svg",
            "alt": alt or titulo,
            "titulo": titulo,
            "descricao": descricao,
            "preco": preco,
            "modal": {
                "id": f"modal-{proximo_id}",
                "imagem": modal_imagem,
                "alt": modal_alt or modal_titulo,
                "titulo": modal_titulo,
                "descricao": modal_descricao,
                "preco": modal_preco,
                "whatsapp_texto": whatsapp_texto,
                "whatsapp_numero": whatsapp_numero
            }
        }
        
        self.produtos.setdefault("produtos", []).append(novo_produto)
        self.salvar_produtos()
        print(f"\n✓ Produto '{titulo}' adicionado com sucesso!")
    
    def editar_produto(self):
        """Edita um produto existente"""
        self.listar_produtos()
        produtos = self.produtos.get("produtos", [])
        
        if not produtos:
            return
        
        try:
            produto_id = int(input("\nDigite o ID do produto para editar: "))
            produto = next((p for p in produtos if p['id'] == produto_id), None)
            
            if not produto:
                print(f"Produto com ID {produto_id} não encontrado.")
                return
            
            print(f"\nEditando: {produto['titulo']}")
            print("(Pressione Enter para manter o valor atual)\n")
            
            # Editar informações básicas
            novo_titulo = input(f"Título [{produto['titulo']}]: ").strip()
            if novo_titulo:
                produto['titulo'] = novo_titulo
            
            nova_descricao = input(f"Descrição [{produto['descricao']}]: ").strip()
            produto['descricao'] = nova_descricao if nova_descricao else produto['descricao']
            
            novo_preco = input(f"Preço [{produto['preco']}]: ").strip()
            if novo_preco:
                produto['preco'] = novo_preco
            
            nova_imagem = input(f"Imagem [{produto['imagem']}]: ").strip()
            if nova_imagem:
                produto['imagem'] = nova_imagem
            
            novo_alt = input(f"Alt da imagem [{produto['alt']}]: ").strip()
            if novo_alt:
                produto['alt'] = novo_alt
            
            # Editar modal
            print("\n--- Editar Modal ---")
            modal = produto['modal']
            novo_modal_titulo = input(f"Título do modal [{modal['titulo']}]: ").strip()
            if novo_modal_titulo:
                modal['titulo'] = novo_modal_titulo
            
            nova_modal_desc = input(f"Descrição do modal [{modal['descricao']}]: ").strip()
            if nova_modal_desc:
                modal['descricao'] = nova_modal_desc
            
            novo_modal_preco = input(f"Preço do modal [{modal['preco']}]: ").strip()
            if novo_modal_preco:
                modal['preco'] = novo_modal_preco
            
            nova_modal_imagem = input(f"Imagem do modal [{modal['imagem']}]: ").strip()
            if nova_modal_imagem:
                modal['imagem'] = nova_modal_imagem
            
            self.salvar_produtos()
            print(f"\n✓ Produto '{produto['titulo']}' editado com sucesso!")
            
        except ValueError:
            print("ID inválido. Digite um número.")
        except Exception as e:
            print(f"Erro ao editar produto: {e}")
    
    def remover_produto(self):
        """Remove um produto"""
        self.listar_produtos()
        produtos = self.produtos.get("produtos", [])
        
        if not produtos:
            return
        
        try:
            produto_id = int(input("\nDigite o ID do produto para remover: "))
            produto = next((p for p in produtos if p['id'] == produto_id), None)
            
            if not produto:
                print(f"Produto com ID {produto_id} não encontrado.")
                return
            
            confirmacao = input(f"\nTem certeza que deseja remover '{produto['titulo']}'? (s/n): ").strip().lower()
            if confirmacao == 's':
                produtos.remove(produto)
                self.salvar_produtos()
                print(f"\n✓ Produto '{produto['titulo']}' removido com sucesso!")
            else:
                print("Operação cancelada.")
                
        except ValueError:
            print("ID inválido. Digite um número.")
        except Exception as e:
            print(f"Erro ao remover produto: {e}")
    
    def menu_principal(self):
        """Exibe o menu principal"""
        while True:
            print("\n" + "="*60)
            print("EDITOR DE PRODUTOS - CANGAÇO")
            print("="*60)
            print("1. Listar produtos")
            print("2. Adicionar produto")
            print("3. Editar produto")
            print("4. Remover produto")
            print("5. Sair")
            print("="*60)
            
            opcao = input("\nEscolha uma opção: ").strip()
            
            if opcao == '1':
                self.listar_produtos()
            elif opcao == '2':
                self.adicionar_produto()
            elif opcao == '3':
                self.editar_produto()
            elif opcao == '4':
                self.remover_produto()
            elif opcao == '5':
                print("\nAté logo!")
                break
            else:
                print("\nOpção inválida. Tente novamente.")


def main():
    """Função principal"""
    editor = EditorProdutos()
    editor.menu_principal()


if __name__ == "__main__":
    main()
