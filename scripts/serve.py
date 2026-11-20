# 本地预览服务器：和 python3 -m http.server 一样，但让浏览器不缓存——改完文件刷新就是新版。
# 用法：python3 scripts/serve.py [端口，默认 8000] [目录，默认当前目录]
# 端口被占用时自动往后找一个空端口，并打印实际地址（截图、给用户的链接都用打印出来的这个）。
import functools, http.server, sys

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = sys.argv[2] if len(sys.argv) > 2 else '.'
for p in range(port, port + 20):
    try:
        srv = http.server.ThreadingHTTPServer(('', p), functools.partial(H, directory=root))
        break
    except OSError:
        continue
else:
    sys.exit(f'{port}–{port + 19} 端口都被占用了，请换一个端口')
if p != port:
    print(f'端口 {port} 被占用，改用 {p}', flush=True)
print(f'预览：http://localhost:{p}/  （Ctrl+C 停止）', flush=True)
srv.serve_forever()
