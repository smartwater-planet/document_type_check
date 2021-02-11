import { ReturnStatement } from "./ReturnStatement";

type Primitive = 'int' | 'float' | 'boolean' | 'string';
type ParserConfig<T> = {
    [key in keyof T]: Primitive | ParserConfig<any>[];
};

class DocumentParser<T> {
    private config: ParserConfig<T>;

    constructor(config: ParserConfig<T>) {
        this.config = config;
    }

    public parse(data: any): ReturnStatement<T> {
        const obj: any = {};
        const items: [string, Primitive | ParserConfig<any>[]][] = Object.entries(this.config);

        for (let i: number = 0; i < items.length; i++) {
            const key: string = items[i][0];
            const type: Primitive | ParserConfig<any>[] = items[i][1];

            if (!(key in data) && !data[key])
                return new ReturnStatement(false);

            const value: any = data[key];

            switch(type) {
                case 'boolean':
                    if (!DocumentParser.is_boolean(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = DocumentParser.as_boolean(value);
                    break;

                case 'string':
                    if (!DocumentParser.is_string(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = value;
                    break;

                case 'int':
                    if (!DocumentParser.is_int(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = value;
                    break;

                case 'float':
                    if (!DocumentParser.is_number(value))
                        return new ReturnStatement(false);

                    obj[key] = value;
                    break;

                default:
                    if (!Array.isArray(type) || !Array.isArray(value))
                        return new ReturnStatement(false);

                    for (let j: number = 0; j < value.length; j++) {
                        const config: ParserConfig<any> = type[0];
                        const parser: DocumentParser<any> = new DocumentParser(config);
                        const result: ReturnStatement<any> = parser.parse(value[j]);
                        if (!result.ok || !result.data)
                            return new ReturnStatement(false);

                        if (obj[key] === undefined) {
                            obj[key] = [result.data];
                        } else {
                            obj[key].push(result.data);
                        } 
                    }
                    break;
            }
        }

        return new ReturnStatement(true, obj as T);
    }
    
    private static is_boolean(val: any): boolean {
        if (typeof val === 'boolean')
            return true;

        if (val === 'true' || val === 'false')
            return true;

        if (val === 1 || val === 0)
            return true;

        return false;
    }

    private static as_boolean(val: any): boolean {
        if (typeof val === 'boolean')
            return val;

        if (val === 'true')
            return true;

        if (val === 'false')
            return false;

        if (val === 1)
            return true;

        if (val === 0)
            return false;

        throw 'not castable to boolean';
    }


    private static is_string(val: any): boolean {
        return typeof val === 'string';
    }

    private static is_int(val: any): boolean {
        if (!DocumentParser.is_number(val))
            return false;

        return Math.trunc(val) === val;
    }

    private static is_number(val: any): boolean {
        return val === Number(val) && !isNaN(val);
    }
}

export { DocumentParser, ParserConfig, Primitive };