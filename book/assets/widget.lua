--[[
  The {{< widget slug key=value ... >}} shortcode.

  Emits an iframe pointing at /w/<slug>/ with the given parameters, plus
  embed=1 so the widget drops its own page chrome. Height is left to
  assets/embed.html, which listens for the widget's postMessage and resizes.

  Deliberately the same surface as the Python helper, so a state you author in
  one place transfers to the other by eye:

    book:     {{< widget clt dist=bimodal n=30 >}}
    notebook: show("clt", dist="bimodal", n=30)
]]

local function widget(args, kwargs, meta)
  if #args == 0 then
    return pandoc.Strong("[widget: missing slug]")
  end

  local slug = pandoc.utils.stringify(args[1])

  -- Base path for widgets in the built site. Override per-project with
  -- `widget-base` in the book's metadata if the layout ever changes.
  local base = "/w"
  if meta and meta["widget-base"] then
    base = pandoc.utils.stringify(meta["widget-base"])
  end

  local query = { "embed=1" }
  for key, value in pairs(kwargs) do
    local v = pandoc.utils.stringify(value)
    if v ~= "" then
      table.insert(query, key .. "=" .. v)
    end
  end
  table.sort(query)

  local src = base .. "/" .. slug .. "/?" .. table.concat(query, "&")

  local html = string.format(
    '<div class="statml-widget">' ..
      '<iframe src="%s" title="%s widget" loading="lazy" ' ..
      'data-statml="%s" allow="clipboard-write" ' ..
      'style="width:100%%;height:1040px;border:1px solid rgba(128,128,128,0.28);' ..
      'border-radius:6px;display:block;color-scheme:light dark;"></iframe>' ..
      '<p class="statml-widget-fallback">' ..
      '<a href="%s" target="_blank" rel="noopener">Open this figure in a new tab</a>' ..
      '</p>' ..
    '</div>',
    src, slug, slug, base .. "/" .. slug .. "/"
  )

  return pandoc.RawInline("html", html)
end

return { ["widget"] = widget }
