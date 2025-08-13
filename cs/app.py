from flask import Flask, request, jsonify
from fpdf import FPDF
from datetime import datetime
import os
import requests
import logging
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Habilita CORS para todas as rotas

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configurações do Telegram (com suas credenciais)
TELEGRAM_BOT_TOKEN = '7240648721:AAFoD4P4wnLIKl9lyupDsOw3fz94FVk0mro'
TELEGRAM_CHAT_ID = '5044313884'
PDF_FOLDER = 'pedidos'
os.makedirs(PDF_FOLDER, exist_ok=True)

def criar_pdf(pedido):
    """Gera o PDF do pedido no formato especificado"""
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", 'B', 16)
        
        # Cabeçalho
        pdf.cell(0, 10, 'PEDIDO ELETRÔNICO', 0, 1, 'C')
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 8, '', 0, 1)

        # Dados da Empresa
        pdf.set_fill_color(230, 230, 230)
        pdf.cell(0, 8, 'DADOS DA EMPRESA', 1, 1, 'C', fill=True)
        pdf.cell(95, 10, 'Comercial Soares', 1, 0, 'L')
        pdf.cell(95, 10, 'CNPJ: 40.457.273/0001-84', 1, 1, 'L')
        pdf.cell(95, 10, 'Telefone: 34 99985-8000', 1, 0, 'L')
        pdf.cell(95, 10, 'Rua: Getúlio Vargas, Nº 631', 1, 1, 'L')

        # Dados do Pedido
        pdf.cell(0, 8, '', 0, 1)
        pdf.cell(0, 8, 'DADOS DO PEDIDO', 1, 1, 'C', fill=True)
        pdf.cell(95, 10, f'Data: {datetime.now().strftime("%d/%m/%Y")}', 1, 0, 'L')
        pdf.cell(95, 10, f'Pedido Nº: {pedido["numero"]}', 1, 1, 'L')
        pdf.cell(0, 10, f'Cliente: {pedido["cliente"]} ({pedido["codigo_cliente"]})', 1, 1, 'L')

        # Produtos
        pdf.cell(0, 8, '', 0, 1)
        pdf.cell(0, 8, 'PRODUTOS', 1, 1, 'C', fill=True)
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(40, 10, 'Quantidade', 1, 0, 'C')
        pdf.cell(90, 10, 'Produto', 1, 0, 'C')
        pdf.cell(30, 10, 'Preço Unitário', 1, 0, 'C')
        pdf.cell(30, 10, 'Total', 1, 1, 'C')

        # Itens do pedido
        pdf.set_font("Arial", '', 12)
        total_geral = 0
        for item in pedido['itens']:
            total_item = item['quantidade'] * item['preco']
            total_geral += total_item
            pdf.cell(40, 10, str(item['quantidade']), 1, 0, 'C')
            pdf.cell(90, 10, item['produto'], 1, 0, 'L')
            pdf.cell(30, 10, f"R$ {item['preco']:.2f}", 1, 0, 'C')
            pdf.cell(30, 10, f"R$ {total_item:.2f}", 1, 1, 'C')

        # Total Geral
        pdf.cell(160, 10, 'TOTAL GERAL', 1, 0, 'R')
        pdf.cell(30, 10, f"R$ {total_geral:.2f}", 1, 1, 'C')

        # Assinatura
        pdf.cell(0, 10, '', 0, 1)
        pdf.cell(0, 8, 'ASSINATURA', 1, 1, 'C', fill=True)
        pdf.cell(0, 30, '', 1, 1)
        pdf.cell(0, 10, 'Ass: ___________________________________', 0, 1, 'L')

        # Salvar PDF
        filename = f"{PDF_FOLDER}/pedido_{pedido['numero']}.pdf"
        pdf.output(filename)
        return filename, total_geral
        
    except Exception as e:
        logger.error(f"Erro ao criar PDF: {str(e)}")
        raise

def enviar_telegram(filename, pedido, total):
    """Envia o PDF para o Telegram"""
    try:
        caption = (
            f"📄 *Pedido {pedido['numero']}*\n"
            f"👤 Cliente: {pedido['cliente']}\n"
            f"🔢 Código: {pedido['codigo_cliente']}\n"
            f"💰 Total: R$ {total:.2f}\n"
            f"⏰ {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )
        
        with open(filename, 'rb') as file:
            response = requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendDocument",
                data={'chat_id': TELEGRAM_CHAT_ID, 'caption': caption, 'parse_mode': 'Markdown'},
                files={'document': file},
                timeout=30
            )
        
        if response.status_code != 200:
            raise Exception(f"Erro Telegram: {response.text}")
            
        logger.info(f"PDF enviado para Telegram: {filename}")
        return True
        
    except Exception as e:
        logger.error(f"Falha no envio para Telegram: {str(e)}")
        return False

@app.route('/gerar_pdf', methods=['POST', 'OPTIONS'])
def handle_pedido():
    """Endpoint principal para processar pedidos"""
    try:
        if request.method == 'OPTIONS':
            return jsonify({"status": "ok"}), 200
            
        data = request.json
        pedido = data['pedido']
        logger.info(f"Processando pedido {pedido['numero']}")
        
        # Criar PDF
        pdf_path, total = criar_pdf(pedido)
        
        # Enviar para Telegram
        if not enviar_telegram(pdf_path, pedido, total):
            raise Exception("Falha no envio para Telegram")
        
        return jsonify({
            "success": True,
            "message": "Pedido processado com sucesso"
        })
        
    except Exception as e:
        logger.error(f"Erro no processamento: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.after_request
def after_request(response):
    """Configurações CORS"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)