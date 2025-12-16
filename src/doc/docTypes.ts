export interface DocLink {
 raw: string;           // как написано в rst
 text?: string;         // текст ссылки (если есть)
 target: string;        // путь или project:path
 rangeStart: number;
 rangeEnd: number;
}

export interface DocTarget {
 filePath: string;
 exists: boolean;
}
