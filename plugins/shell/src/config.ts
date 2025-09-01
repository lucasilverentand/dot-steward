import type { Shell, ShellItem } from "./items";

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export class ShellConfig {
  private envVars = new Map<string, string>();
  private aliases = new Map<string, string>();
  private paths: string[] = [];

  collect(item: ShellItem): void {
    if (item.kind === "env") {
      this.envVars.set(item.key, item.value);
    } else if (item.kind === "alias") {
      this.aliases.set(item.name, item.command);
    } else if (item.kind === "path") {
      this.paths.push(item.dir);
    }
  }

  render(_shell: Shell): string {
    const lines: string[] = [];
    for (const [key, value] of this.envVars) {
      lines.push(`export ${key}=${quote(value)}`);
    }
    if (this.paths.length > 0) {
      const joined = this.paths.join(":");
      lines.push(`export PATH=${quote(`${joined}:$PATH`)}`);
    }
    for (const [name, command] of this.aliases) {
      const escaped = command.replace(/'/g, "'\\''");
      lines.push(`alias ${name}='${escaped}'`);
    }
    return lines.join("\n");
  }

  renderAll(): Record<Shell, string> {
    return {
      bash: this.render("bash"),
      zsh: this.render("zsh"),
      sh: this.render("sh"),
    };
  }
}
