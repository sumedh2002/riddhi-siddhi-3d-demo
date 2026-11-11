# usage: python3 -I enh.py <k> [<k> ...]   Blender frame orbit/f-KK.jpg -> ai/f-KK.jpg (photo-real, same layout)
import base64, json, subprocess, sys, os, concurrent.futures as cf
D = os.path.dirname(os.path.abspath(__file__))
P = ("This is a 3D render of a real-estate project seen from a drone: a cream 8-storey apartment building with two terracotta pyramid roof turrets, in a planned neighbourhood. "
 "Turn it into an ultra-realistic aerial drone photograph. Keep the camera angle and framing exactly, and keep every building, road, footpath, plot and tree in exactly the same place, size and shape; do not add, remove or move anything and do not add text. "
 "Only add real-world detail and light: the main building is brand new with cream plaster walls, crisp white mouldings, blue-tinted glass windows, glass balcony railings and clay-tiled turret roofs; "
 "a paved compound with a boundary wall and gate; neighbouring apartment blocks with real facades, balconies, windows and rooftop water tanks; asphalt roads with lane markings, kerbs, a few cars and street lights; "
 "real tropical trees and coconut palms in place of the modelled trees; lawns with natural grass. Clear sunny late-morning light in Navi Mumbai, soft realistic shadows, slight atmospheric haze toward the horizon, natural colours, sharp detail. No watermark.")
def run(k):
    src = f'{D}/orbit/f-{k:02d}.jpg'; out = f'{D}/ai/f-{k:02d}.jpg'
    body = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(open(src, 'rb').read()).decode()}}, {"text": P}]}], "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"}}}
    rq = out + '.req.json'; json.dump(body, open(rq, 'w'))
    r = subprocess.run(['curl', '-s', '-m', '400', '-H', 'Content-Type: application/json', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent', '-d', f'@{rq}'], capture_output=True, text=True); os.remove(rq)
    try: d = json.loads(r.stdout)
    except Exception: d = {}
    img = next((p.get('inlineData') for c in d.get('candidates', []) for p in c.get('content', {}).get('parts', []) if p.get('inlineData')), None)
    if not img: return f'{k}: FAIL {json.dumps(d)[:200]}'
    open(out + '.raw', 'wb').write(base64.b64decode(img['data'])); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out + '.raw', '-q:v', '2', out]); os.remove(out + '.raw'); return f'{k}: ok'
with cf.ThreadPoolExecutor(6) as ex:
    for res in ex.map(run, [int(x) for x in sys.argv[1:]]): print(res, flush=True)
