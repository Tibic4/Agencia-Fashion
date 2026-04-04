import zipfile
import re
import sys

docx_path = r'c:\Users\Beatriz Modas\Downloads\campanha_ia_para_opus.docx'
out_path = r'c:\Users\Beatriz Modas\Desktop\VarejoFlow\out.txt'

with zipfile.ZipFile(docx_path, 'r') as z:
    with z.open('word/document.xml') as f:
        content = f.read().decode('utf-8')

# Extract text between XML tags, preserving paragraph breaks
paragraphs = re.findall(r'<w:p[ >].*?</w:p>', content, re.DOTALL)
lines = []
for p in paragraphs:
    texts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', p)
    line = ''.join(texts)
    lines.append(line)

result = '\n'.join(lines)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(result)

print(f"Extracted {len(lines)} lines to {out_path}")
