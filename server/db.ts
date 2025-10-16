import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database } from 'sql.js';

export async function openDb(dbPath: string) {
  const SQL = await initSqlJs();
  const filePath = path.resolve(dbPath);
  const hasFile = fs.existsSync(filePath);
  const db = new SQL.Database(hasFile ? fs.readFileSync(filePath) : undefined);
  if (!hasFile) {
    const schema = fs.readFileSync(path.join(process.cwd(), 'server', 'schema.sql'), 'utf-8');
    db.run(schema);
    fs.writeFileSync(filePath, Buffer.from(db.export()));
  }

  const save = () => fs.writeFileSync(filePath, Buffer.from(db.export()));

  return {
    prepare(sql: string) {
      return {
        all: (params?: any[]) => {
          const stmt = db.prepare(sql);
          if (params) stmt.bind(params);
          const rows: any[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        get: (params?: any[]) => {
          const stmt = db.prepare(sql);
          if (params) stmt.bind(params);
          const row = stmt.step() ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        run: (params?: any[]) => {
          const stmt = db.prepare(sql);
          if (params) stmt.bind(params);
          stmt.step();
          stmt.free();
          save();
          return { lastInsertRowid: 0 } as any;
        }
      } as any;
    },
    transaction(fn: (arg: any) => void) {
      return (arg: any) => {
        db.run('BEGIN');
        try {
          fn(arg);
          db.run('COMMIT');
          save();
        } catch (e) {
          db.run('ROLLBACK');
          throw e;
        }
      };
    }
  } as any;
}


