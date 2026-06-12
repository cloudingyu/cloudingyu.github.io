# frozen_string_literal: true

require "cgi"
require "jekyll/converters/markdown"

module MathMarkdownProtect
  TOKEN_PREFIX = "CYMATHPROTECT"

  module_function

  def registry
    @registry ||= {}
  end

  def next_token(math)
    @counter ||= 0
    token = "#{TOKEN_PREFIX}#{@counter}X"
    @counter += 1
    registry[token] = math
    token
  end

  def protect(content)
    tokens = {}
    in_fence = false

    protected_content = content.lines.map do |line|
      if line.match?(/^\s*(```|~~~)/)
        in_fence = !in_fence
        line
      elsif in_fence
        line
      elsif line.lstrip.start_with?("#")
        line
      else
        protect_inline_math(line, tokens)
      end
    end.join

    [protected_content, tokens]
  end

  def restore(output, tokens)
    tokens.each do |token, math|
      output = output.gsub(token) { CGI.escapeHTML(math) }
    end
    output
  end

  def protect_inline_math(line, tokens)
    output = +""
    i = 0

    while i < line.length
      if line[i] == "`"
        code_end = line.index("`", i + 1)
        if code_end
          output << line[i..code_end]
          i = code_end + 1
        else
          output << line[i]
          i += 1
        end
      elsif line[i] == "$" && line[i + 1] == "$"
        math_end = line.index("$$", i + 2)
        if math_end
          output << line[i..(math_end + 1)]
          i = math_end + 2
        else
          output << line[i]
          i += 1
        end
      elsif line[i] == "$" && line[i - 1] != "\\" && line[i + 1] != "$"
        math_end = find_inline_math_end(line, i + 1)
        if math_end
          math = line[i..math_end]
          token = next_token(math)
          tokens[token] = math
          output << token
          i = math_end + 1
        else
          output << line[i]
          i += 1
        end
      else
        output << line[i]
        i += 1
      end
    end

    output
  end

  def find_inline_math_end(line, start)
    i = start
    while i < line.length
      return i if line[i] == "$" && line[i - 1] != "\\" && line[i + 1] != "$"

      i += 1
    end
    nil
  end
end

Jekyll::Hooks.register [:documents, :pages], :post_render do |item|
  next unless item.output&.include?(MathMarkdownProtect::TOKEN_PREFIX)

  item.output = MathMarkdownProtect.restore(item.output, MathMarkdownProtect.registry)
end

module Jekyll
  module Converters
    class Markdown
      unless method_defined?(:convert_without_math_markdown_protect)
        alias_method :convert_without_math_markdown_protect, :convert

        def convert(content)
          protected_content, tokens = MathMarkdownProtect.protect(content)
          output = convert_without_math_markdown_protect(protected_content)
          tokens.empty? ? output : MathMarkdownProtect.restore(output, tokens)
        end
      end
    end
  end
end
