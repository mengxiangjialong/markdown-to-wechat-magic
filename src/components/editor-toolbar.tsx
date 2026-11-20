import { Bold, Italic, Link, Quote, Code, Image, ImageUp, Square, Info, Minus, Undo2, Redo2, ChevronDown, List, ListOrdered, Heading, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ToolButton({ label, icon: Icon, onClick }: { label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const icons: LucideIcon[] = [Bold, Italic, Link, Quote, Code, Image, ImageUp, Square, Info, Minus];

export function EditorToolbar({ tools, undo, redo, setHeading, setUnorderedList, setOrderedList }: {
  tools: [string, () => void][];
  undo: () => void;
  redo: () => void;
  setHeading: (depth: number) => void;
  setUnorderedList: () => void;
  setOrderedList: () => void;
}) {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="文章格式">
      <div className="toolbar-group">
        <ToolButton label="撤销" icon={Undo2} onClick={undo} />
        <ToolButton label="重做" icon={Redo2} onClick={redo} />
      </div>
      <div className="toolbar-group">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground" aria-label="标题级别"><Heading /><span>标题</span><ChevronDown className="size-3" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={(event) => event.preventDefault()}>
            {["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"].map((label, index) => (
              <DropdownMenuItem key={label} onSelect={() => setHeading(index + 1)}><span className="w-6 text-muted-foreground">H{index + 1}</span>{label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground" aria-label="列表类型"><List /><span>列表</span><ChevronDown className="size-3" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={(event) => event.preventDefault()}>
            <DropdownMenuItem onSelect={setUnorderedList}><List />无序列表</DropdownMenuItem>
            <DropdownMenuItem onSelect={setOrderedList}><ListOrdered />有序列表</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="toolbar-group toolbar-formats">
        {tools.map(([label, onClick], index) => {
          const icon = icons[index];
          return icon ? <ToolButton key={label} label={label === "B" ? "加粗" : label === "I" ? "斜体" : label} icon={icon} onClick={onClick} /> : null;
        })}
      </div>
    </div>
  );
}