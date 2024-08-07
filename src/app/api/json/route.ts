import { openai } from "@/lib/openai"
import { NextRequest, NextResponse } from "next/server"
import { z, ZodTypeAny } from "zod"
import { EXAMPLE_ANSWER, EXAMPLE_PROMPT } from "./example"


// Determines the type of a given schema
const determineSchemaType = (schema: any): string => {
    // If schema is like {type: "string"}   -->  Return "string"
    // If schema is an array                -->  Return "array"

    if(!schema.hasOwnProperty("type")){
        if(Array.isArray(schema)) return "array"
        else                      return typeof schema
    }

    return schema.type
}


// Converts the format provided by the user to a zod format:
// "format": {
//    "age": {"type":"number"}      --->    z.number()
// }
const jsonSchemaToZod = (schema: any): ZodTypeAny => {

    const type = determineSchemaType(schema)

    switch (type) {
        case "string":
            return z.string().nullable()
        
        case "number":
            return z.number().nullable()

        case "boolean":
            return z.boolean().nullable()

        case "array":
            return z.array(jsonSchemaToZod(schema.items)).nullable()

        case "object":  // If schema is an object, recursively process each key
            const shape: Record<string, ZodTypeAny> = {}    // map of properties: [key1:type1, key2:type2, ...]

            for (const key in schema) {
                if(key !== "type") shape[key] = jsonSchemaToZod(schema[key])
            }

            return z.object(shape)

        default:
            throw new Error(`Unsupported data type: ${type}`)
    }
}


type PromiseExecutor<T> = (
    resolve: (value: T) => void,
    reject: (reason?: any) => void
) => void


class RetryablePromise<T> extends Promise<T> {
    static async retry<T>(retries: number, executor: PromiseExecutor<T>): Promise<T> {
        return new RetryablePromise(executor).catch((error) => {
            console.error(`Retrying due to error: ${error}`)

            return retries > 0
                ? RetryablePromise.retry(retries - 1, executor)
                : RetryablePromise.reject(error)
        })
    }
}



export const POST = async (req: NextRequest) => {

    const body = await req.json()

    // Step 1: make sure incoming request is valid
    const genericSchema = z.object({
        data: z.string(),
        format: z.object({}).passthrough()
    })

    const { data, format } = genericSchema.parse(body)

    // Step 2: create schema from the expected user format
    const dynamicSchema = jsonSchemaToZod(format)


    // Step 3
    const validationResult = await RetryablePromise.retry<object>(5, async (resolve, reject) => {
        try {
            // Call AI
            const res = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "assistant",
                        content: "You are an AI that converts data into the attached JSON format. You respond with nothing but valid JSON based on the input data. Your output should DIRECTLY be valid JSON, nothing added before and after. You will begin with the opening curly brace. Only if you absolutely cannot determine a field, use the value null."
                    },
                    {
                        role: "user",
                        content: EXAMPLE_PROMPT
                    },
                    {
                        role: "user",
                        content: EXAMPLE_ANSWER
                    },
                    {
                        role: "user",
                        content: `DATA: \n"${data}"\n\n-----------\nExpected JSON format:
                                    ${JSON.stringify(format, null, 2)}
                                    \n\n-----------\nValid JSON output in expected format:`
                    }
                ]
            })

            const text = res.choices[0].message.content

            // Validate JSON. If text is null, pass an empty string
            const validationResult = dynamicSchema.parse(JSON.parse(text || ""))

            return resolve(validationResult)
        } catch (err) {
            reject(err)
        }
    })


    return NextResponse.json(validationResult, { status:200 })
}