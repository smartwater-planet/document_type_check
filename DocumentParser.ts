import { ResumeToken } from "mongodb";
import { Type } from "./Enums";
import { ResponseObject } from "./ResponseObject";
import { ReturnStatement } from "./ReturnStatement";

type Primitive = 'int' | 'int[]' |
                'int?' | 'int[]?' |
                'float' | 'float?' |
                'boolean' | 'boolean?' |
                'string' | 'string[]' |
                'string?' | 'string[]?' |
                'mixed[]' | 'mixed[]?' |
                'mixed' | 'mixed?' |
                'null' | 'null?';

type ParserConfig<T> = {
    [key in keyof T]: Primitive | Primitive[] | ParserConfig<any>[];
};

class DocumentParser<T> {
    private config: ParserConfig<T>;
    private hardCheck: boolean;

    constructor(config: ParserConfig<T>, hardCheck: boolean = true) {
        this.config = config;
        this.hardCheck = hardCheck;
    }

    public parse(data: any): ReturnStatement<T> {
        const obj: any = {};
        const items: [string, Primitive | Primitive[] | ParserConfig<any>[]][] = Object.entries(this.config);

        for (let i: number = 0; i < items.length; i++) {
            const key: string = items[i][0];
            const typeConfiguration: Primitive | Primitive[] | ParserConfig<any>[] = items[i][1];

            const value: any = data[key];

            let arr: any[] | false; //For array types check
            switch(typeConfiguration) {
                case 'boolean?':
                    if (!(key in data))
                        break;
                case 'boolean':
                    if (!this.is_boolean(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = this.as_boolean(value);
                    break;


                case 'string?':
                    if (!(key in data))
                        break;
                case 'string':
                    if (!this.is_string(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = value;
                    break;

                case 'string[]?':
                    if (!(key in data))
                        break;
                case 'string[]':
                    arr = this.is_array('string', value);
                    if (!arr)
                        return new ReturnStatement(false);

                    obj[key] = arr;
                    break;


                case 'int?':
                    if (!(key in data))
                        break;
                case 'int':
                    if (!this.is_int(value))
                        return new ReturnStatement(false);
                    
                    obj[key] = Number(value);
                    break;


                case 'int[]?':
                    if (!(key in data))
                        break;
                case 'int[]':
                    arr = this.is_array('int', value);
                    if (!arr)
                        return new ReturnStatement(false);

                    obj[key] = arr;
                    break;


                case 'float?':
                    if (!(key in data))
                        break;
                case 'float':
                    if (!this.is_number(value))
                        return new ReturnStatement(false);

                    obj[key] = Number(value);
                    break;


                case 'null?':
                    if (!(key in data))
                        break;
                case 'null':
                    if (!this.is_null(value))
                        return new ResponseObject(false);

                    obj[key] = null;
                    break;

                case 'mixed?':
                    if (!(key in data))
                        break;
                case 'mixed':
                    obj[key] = this.parse_mixed(value);
                    break;


                case 'mixed[]?':
                    if (!(key in data))
                        break;
                case 'mixed[]':
                    arr = this.is_array('mixed', value);
                    if (!arr)
                        return new ReturnStatement(false);

                    obj[key] = arr;
                    break;


                default:
                    //We have an array configuration
                    if (Array.isArray(typeConfiguration)) {
                        const result: ReturnStatement<any> = this.array_parser(typeConfiguration, value);
                        if (!result.ok || result.data === undefined)
                            return new ReturnStatement(false);

                        obj[key] = result.data;

                    } else {
                        return new ReturnStatement(false);

                    }
            }
        }

        return new ReturnStatement(true, obj as T);
    }


    private array_parser(configuration: Primitive[] | ParserConfig<any>[], value: any): ReturnStatement<any> {
        const typeConfig: Primitive | ParserConfig<any> = configuration[0];
        const effectiveType: string = typeof typeConfig;

        let output: ReturnStatement<any>;
        switch(effectiveType) {
            //Configuration array check
            case 'object':
                if (!Array.isArray(value)) {
                    output = new ReturnStatement(false);
                
                } else {
                    output = this.parse_array_config(typeConfig as ParserConfig<any>, value);

                }
                break;

            //Multiple types check
            case 'string':
                if (Array.isArray(value)) {
                    output = new ReturnStatement(false);

                } else {
                    output = this.parse_multiple_types(configuration as Primitive[], value);

                }

                break;

            default:
                output = new ReturnStatement(false);
                break;
        }

        return output;
    }

    private parse_array_config(typeConfig: ParserConfig<any>, value: any[]): ReturnStatement<any[]> {
        //Array configuration
        const output: any[] = [];
        for (let i: number = 0; i < value.length; i++) {
            const parser: DocumentParser<any> = new DocumentParser(typeConfig, this.hardCheck);
            const result: ReturnStatement<any> = parser.parse(value[i]);
            if (!result.ok || result.data === undefined)
                return new ReturnStatement(false);

            output.push(result.data);
        }

        return new ReturnStatement(true, output);
    }

    private parse_multiple_types(typesConfig: Primitive[], value: any): ReturnStatement<any> {
        for (let i: number = 0; i < typesConfig.length; i++) {
            const conf = { key: typesConfig[i] };
            const val = { key: value };

            const parser: DocumentParser<any> = new DocumentParser(conf, this.hardCheck);
            const result: ReturnStatement<any> = parser.parse(val);
            if (result.ok && result.data !== undefined)
                return new ReturnStatement(true, result.data.key);
        }

        return new ReturnStatement(false);
    }


    private parse_mixed(val: any): any {
        let out: any;

        if (this.is_number(val)) {
            out = Number(val);
        
        } else if (this.is_boolean(val)) {
            out = this.as_boolean(val);

        } else if (this.is_null(val)) {
            out = null;

        } else if (this.is_string(val)) {
            out = val;
        } else {
            throw 'value is not castable';
        }

        return out;
    }
    

    private is_array(type: Primitive, value: any): any[] | false {
        let arrToCheck: any[];

        if (this.hardCheck && Array.isArray(value)) {
            arrToCheck = value;

        } else if (this.hardCheck) {
            return false;

        } else if (!this.is_string(value)) {
            return false;

        } else {
            const splt: string[] = value.split(',');
            if (splt.length == 0)
                return false;

            arrToCheck = splt;
        }


        switch (type) {
            case 'int':
                return this.as_int_array(arrToCheck);

            case 'string':
                return this.as_string_array(arrToCheck);

            case 'mixed':
                return this.as_mixed_array(arrToCheck);

            default:
                return false;
        }
    }

    private as_int_array(value: any[]): any[] | false {
        for (let i: number = 0; i < value.length; i++) {
            if (!this.is_int(value[i]))
                return false;

            value[i] = Number(value[i]);
        }

        return value;
    }

    private as_string_array(value: any[]): any[] | false {
        for (let i: number = 0; i < value.length; i++) {
            if (!this.is_string(value[i]))
                return false;
        }

        return value;
    }

    private as_mixed_array(value: any[]): any[] {
        for (let i: number = 0; i < value.length; i++) {
            value[i] = this.parse_mixed(value[i]);
        }

        return value;
    }


    private is_boolean(val: any): boolean {
        if (this.hardCheck) {
            return typeof val === 'boolean';

        } else {
            if (typeof val === 'boolean')
                return true;

            if (val === 'true' || val === 'false')
                return true;
    
            if (val === 1 || val === 0)
                return true;

            if (val === '1' || val === '0')
                return true;
        }
            
        return false;
    }

    private as_boolean(val: any): boolean {
        if (typeof val === 'boolean')
            return val;

        if (val === 'true')
            return true;

        if (val === 'false')
            return false;

        if (val === 1 || val === '1')
            return true;

        if (val === 0 || val === '0')
            return false;

        throw 'not castable to boolean';
    }


    private is_string(val: any): boolean {
        //Always hardcheck
        return typeof val === 'string';
    }

    private is_int(val: any): boolean {
        if (!this.is_number(val))
            return false

        const n = Number(val);
        return Math.trunc(n) === n;
    }

    private is_number(val?: any) {
        return this.hardCheck ? 
            (typeof val === 'number') : (val !== null && !isNaN(val));
    }

    private is_null(val?: any) {
        return this.hardCheck ?
            val === null : val === 'null' || val === null;
    }
}

export { DocumentParser, ParserConfig, Primitive };
