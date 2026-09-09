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

replace_once(
    'js/main.js',
    "if (activeSearch) list = list.filter(p => (p.name || '').toLowerCase().includes(activeSearch));",
    "if (activeSearch) list = list.filter(p => { const haystack = [p.name, p.category, p.description, p.short_description, p.tags, p.keywords, p.slug].filter(Boolean).join(' ').toLowerCase(); return haystack.includes(activeSearch); });",
    'catalog search'
)

index = Path('index.html')
s = index.read_text(encoding='utf-8')
css_marker = '  <link rel="stylesheet" href="css/components.css">'
for css_tag in [
    '  <link rel="stylesheet" href="css/storefront-fixes.css">',
    '  <link rel="stylesheet" href="css/luxury-final.css">'
]:
    if css_tag not in s:
        if css_marker not in s:
            raise SystemExit('index: components.css marker not found')
        s = s.replace(css_marker, css_marker + '\n' + css_tag, 1)

js_marker = '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
for js_tag in [
    '  <script src="js/storefront-fixes.js" defer></script>',
    '  <script src="js/luxury-final.js" defer></script>'
]:
    if js_tag not in s:
        if js_marker not in s:
            raise SystemExit('index: supabase script marker not found')
        s = s.replace(js_marker, js_marker + '\n' + js_tag, 1)

index.write_text(s, encoding='utf-8')
print('index: all storefront layers linked')
