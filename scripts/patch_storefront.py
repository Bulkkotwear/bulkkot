from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if new in s:
        print(f'{label}: already applied')
        return False
    if old not in s:
        raise SystemExit(f'{label}: pattern not found in {path}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')
    print(f'{label}: applied')
    return True

# Main catalog search: name + category + description + tags/keywords.
replace_once(
    'js/main.js',
    "if (activeSearch) list = list.filter(p => (p.name || '').toLowerCase().includes(activeSearch));",
    "if (activeSearch) list = list.filter(p => { const haystack = [p.name, p.category, p.description, p.short_description, p.tags, p.keywords, p.slug].filter(Boolean).join(' ').toLowerCase(); return haystack.includes(activeSearch); });",
    'catalog search'
)

# Load the production polish layer once, without replacing the existing architecture.
index = Path('index.html')
s = index.read_text(encoding='utf-8')
css_tag = '  <link rel="stylesheet" href="css/storefront-fixes.css">'
js_tag = '  <script src="js/storefront-fixes.js" defer></script>'
if css_tag not in s:
    marker = '  <link rel="stylesheet" href="css/components.css">'
    if marker not in s: raise SystemExit('index: components.css marker not found')
    s = s.replace(marker, marker + '\n' + css_tag, 1)
if js_tag not in s:
    marker = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    if marker not in s: raise SystemExit('index: supabase script marker not found')
    s = s.replace(marker, marker + '\n' + js_tag, 1)
index.write_text(s, encoding='utf-8')
print('index: fix assets linked')
