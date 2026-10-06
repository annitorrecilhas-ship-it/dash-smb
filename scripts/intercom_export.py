#!/usr/bin/env python3
"""Exporta métricas do time Ongoing SMB (Intercom) para dados/intercom_smb.json.

Roda no GitHub Actions com a chave no secret INTERCOM_TOKEN (nunca impressa nem gravada).
Saída anônima e agregada por dia (horário de Brasília) e por atendente:
contagem de conversas, notas de avaliação, tempos de 1ª resposta e de atendimento e status de SLA.
Sem textos de conversa, sem IDs de conversa e sem dados de clientes.
"""
import json, os, sys, time, urllib.request, urllib.error, datetime as dt

TEAM_ID = 10441398
API = 'https://api.intercom.io'
BRT = dt.timezone(dt.timedelta(hours=-3))


def call(path, token, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 method='POST' if body is not None else 'GET')
    req.add_header('Authorization', 'Bearer ' + token)
    req.add_header('Intercom-Version', '2.11')
    req.add_header('Accept', 'application/json')
    if body is not None:
        req.add_header('Content-Type', 'application/json')
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(5 * (tentativa + 1)); continue
            sys.exit(f'Erro HTTP {e.code} em {path}')
    sys.exit(f'Falhou após 5 tentativas: {path}')


def inicio_janela(agora):
    # dia 1 do mês atual menos 3 meses (00:00 BRT)
    y, m = agora.year, agora.month - 3
    while m <= 0:
        m += 12; y -= 1
    return dt.datetime(y, m, 1, tzinfo=BRT)


def agregar(conversas):
    dias = {}
    for c in conversas:
        d = dt.datetime.fromtimestamp(c['created_at'], BRT).strftime('%Y-%m-%d')
        a = str(c.get('admin_assignee_id') or 'none')
        b = dias.setdefault(d, {}).setdefault(a, {'n': 0, 'r': [], 'fro': [], 'aht': [], 'sla': [0, 0]})
        b['n'] += 1
        s = c.get('statistics') or {}
        for t in s.get('assigned_team_first_response_time_in_office_hours') or []:
            if t.get('team_id') == TEAM_ID and t.get('response_time') is not None:
                b['fro'].append(int(t['response_time']))
        if s.get('adjusted_handling_time') is not None:
            b['aht'].append(int(s['adjusted_handling_time']))
        rating = (c.get('conversation_rating') or {}).get('rating')
        if rating:
            b['r'].append(int(rating))
        st = (c.get('sla_applied') or {}).get('sla_status')
        if st == 'hit':
            b['sla'][0] += 1
        elif st == 'missed':
            b['sla'][1] += 1
    return dias


def main():
    token = os.environ.get('INTERCOM_TOKEN')
    if not token:
        sys.exit('Secret INTERCOM_TOKEN não configurado.')
    me = call('/me', token)
    print('Autenticado como', me.get('name'), '|', (me.get('app') or {}).get('name'))
    admins = {str(a['id']): a['name'] for a in call('/admins', token).get('admins', [])}
    agora = dt.datetime.now(BRT)
    desde = int(inicio_janela(agora).timestamp())
    conversas, cursor, pag = [], None, 0
    while True:
        p = {'per_page': 150}
        if cursor:
            p['starting_after'] = cursor
        q = {'query': {'operator': 'AND', 'value': [
            {'field': 'team_assignee_id', 'operator': '=', 'value': str(TEAM_ID)},
            {'field': 'created_at', 'operator': '>', 'value': desde}]}, 'pagination': p}
        r = call('/conversations/search', token, q)
        conversas += r.get('conversations', [])
        pag += 1
        cursor = ((r.get('pages') or {}).get('next') or {}).get('starting_after')
        if not cursor:
            break
    print(f'{len(conversas)} conversas em {pag} páginas')
    out = {'gerado_em': agora.isoformat(timespec='seconds'), 'desde': desde, 'time': TEAM_ID,
           'total': len(conversas), 'admins': admins, 'dias': agregar(conversas)}
    os.makedirs('dados', exist_ok=True)
    with open('dados/intercom_smb.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


if __name__ == '__main__':
    main()
