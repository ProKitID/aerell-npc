/*
Credit{Source}: https://github.com/MinecraftBedrockArabic/Script-API-snippets/blob/main/structure summon detector/structureDetector.js
*/

import { system, Dimension, Block, type Vector3 } from "@minecraft/server";

export type Pattern3D = string[][]; // 3D: [y][z][x]
export type PatternTypes = Record<string, string>; // "A": "minecraft:stone"

export type SummonEntityFn = (dimension: Dimension, origin: Vector3) => void;

interface Offset {
    x: number;
    y: number;
    z: number;
}

interface StateFlag {
    isDone: boolean;
}

class StructureDetector {
    patternTypes: PatternTypes;
    basePattern: Pattern3D;
    triggerBlock: string;
    transformedPatterns: Pattern3D[];
    summonEntity: SummonEntityFn;

    static instances: StructureDetector[] = [];

    constructor(
        patternTypes: PatternTypes,
        basePattern: Pattern3D,
        summonEntity: SummonEntityFn
    ) {
        this.patternTypes = patternTypes;
        this.basePattern = basePattern;
        this.triggerBlock = this.patternTypes[Object.keys(this.patternTypes).pop()!]!;
        this.transformedPatterns = this.generateAllTransformations();
        this.summonEntity = summonEntity;

        StructureDetector.instances.push(this);
    }

    /** Generate full pattern transformations */
    private generateAllTransformations(): Pattern3D[] {
        const transformations: Pattern3D[] = [];
        const seen = new Map<string, boolean>();

        const baseTransforms = [
            this.basePattern,
            StructureDetector.flipEntirePattern(this.basePattern),
            StructureDetector.transposeYZ(this.basePattern),
            StructureDetector.transposeXY(this.basePattern),
        ];

        for (let current of baseTransforms) {
            for (let i = 0; i < 4; i++) {
                this.addUniquePattern(transformations, seen, current);
                this.addUniquePattern(transformations, seen, current.map(layer => StructureDetector.flipLayerHorizontal(layer)));
                this.addUniquePattern(transformations, seen, current.map(layer => StructureDetector.flipLayerVertical(layer)));

                current = current.map(layer => StructureDetector.rotateLayer(layer));
            }
        }

        return transformations;
    }

    private addUniquePattern(
        transformations: Pattern3D[],
        seen: Map<string, boolean>,
        pattern: Pattern3D
    ) {
        const hash = this.hashPattern(pattern);
        if (!seen.has(hash)) {
            seen.set(hash, true);
            transformations.push(pattern);
        }
    }

    private hashPattern(pattern: Pattern3D): string {
        return pattern.map(layer => layer.join("|")).join("||");
    }

    /** Triggered on block update */
    detectStructure(dimension: Dimension, block: Block) {
        if (block.typeId !== this.triggerBlock) return;
        system.runJob(this.detectAllPatternsJob(dimension, block));
    }

    private *detectAllPatternsJob(dimension: Dimension, block: Block) {
        const state: StateFlag = { isDone: false };

        for (const transformed of this.transformedPatterns) {
            if (state.isDone) return;

            const triggers = this.getTriggerBlockOffsets(transformed);

            for (const offset of triggers) {
                if (state.isDone) return;

                const origin: Vector3 = {
                    x: Math.floor(block.location.x - offset.x),
                    y: Math.floor(block.location.y - offset.y),
                    z: Math.floor(block.location.z - offset.z),
                };

                yield* this.checkStructureJob(dimension, origin, transformed, state);
            }
        }
    }

    private getTriggerBlockOffsets(pattern: Pattern3D): Offset[] {
        const offsets: Offset[] = [];

        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y]!.length; z++) {
                for (let x = 0; x < pattern[y]![z]!.length; x++) {
                    if (this.patternTypes[pattern[y]![z]![x]!] === this.triggerBlock) {
                        offsets.push({ x, y, z });
                    }
                }
            }
        }

        return offsets;
    }

    private *checkStructureJob(
        dimension: Dimension,
        origin: Vector3,
        pattern: Pattern3D,
        state: StateFlag
    ) {
        if (state.isDone) return;

        let count = 0;

        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y]!.length; z++) {
                for (let x = 0; x < pattern[y]![z]!.length; x++) {
                    const expected = this.patternTypes[pattern[y]![z]![x]!];
                    if (!expected) continue;

                    const pos = { x: origin.x + x, y: origin.y + y, z: origin.z + z };
                    const block = dimension.getBlock(pos);

                    if (!block || block.typeId !== expected) return;

                    if (++count % 5 === 0) yield;
                }
            }
        }

        if (state.isDone) return;
        state.isDone = true;

        yield* this.removeStructureChunkedJob(dimension, origin, pattern);
        this.summonEntity(dimension, origin);
    }

    private *removeStructureChunkedJob(
        dimension: Dimension,
        origin: Vector3,
        pattern: Pattern3D
    ) {
        let count = 0;

        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y]!.length; z++) {
                for (let x = 0; x < pattern[y]![z]!.length; x++) {
                    if (this.patternTypes[pattern[y]![z]![x]!]) {
                        const pos = {
                            x: origin.x + x,
                            y: origin.y + y,
                            z: origin.z + z,
                        };
                        const block = dimension.getBlock(pos);
                        block?.setType("minecraft:air");

                        if (++count % 5 === 0) yield;
                    }
                }
            }
        }
    }

    // -------------------- Static Pattern Operations --------------------

    static rotateLayer(layer: string[]): string[] {
        const rotated: string[] = [];
        for (let col = 0; col < layer[0]!.length; col++) {
            let row = "";
            for (let rowIndex = layer.length - 1; rowIndex >= 0; rowIndex--) {
                row += layer[rowIndex]![col];
            }
            rotated.push(row);
        }
        return rotated;
    }

    static flipLayerHorizontal(layer: string[]): string[] {
        return layer.map(row => row.split("").reverse().join(""));
    }

    static flipLayerVertical(layer: string[]): string[] {
        return [...layer].reverse();
    }

    static flipEntirePattern(pattern: Pattern3D): Pattern3D {
        return pattern.map(layer => this.flipLayerVertical(layer)).reverse();
    }

    static transposeYZ(pattern: Pattern3D): Pattern3D {
        const result: Pattern3D = [];
        for (let z = 0; z < pattern[0]!.length; z++) {
            const layer: string[] = [];
            for (let y = 0; y < pattern.length; y++) {
                layer.push([...pattern[y]![z]!].join(""));
            }
            result.push(layer);
        }
        return result;
    }

    static transposeXY(pattern: Pattern3D): Pattern3D {
        const result: Pattern3D = [];
        for (let y = 0; y < pattern.length; y++) {
            const layer: string[] = [];
            for (let x = 0; x < pattern[0]![0]!.length; x++) {
                let row = "";
                for (let z = 0; z < pattern[0]!.length; z++) {
                    row += pattern[y]![z]![x]!;
                }
                layer.push(row);
            }
            result.push(layer);
        }
        return result;
    }
}

export default StructureDetector;
