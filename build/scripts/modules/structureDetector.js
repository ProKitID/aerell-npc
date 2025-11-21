/*
Credit{Source}: https://github.com/MinecraftBedrockArabic/Script-API-snippets/blob/main/structure summon detector/structureDetector.js
*/
import { system } from "@minecraft/server";
class StructureDetector {
    constructor(patternTypes, basePattern, summonEntity) {
        this.patternTypes = patternTypes;
        this.basePattern = basePattern;
        this.triggerBlock = this.patternTypes[Object.keys(this.patternTypes).pop()];
        this.transformedPatterns = this.generateAllTransformations();
        this.summonEntity = summonEntity;
        StructureDetector.instances.push(this);
    }
    /** Generate full pattern transformations */
    generateAllTransformations() {
        const transformations = [];
        const seen = new Map();
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
    addUniquePattern(transformations, seen, pattern) {
        const hash = this.hashPattern(pattern);
        if (!seen.has(hash)) {
            seen.set(hash, true);
            transformations.push(pattern);
        }
    }
    hashPattern(pattern) {
        return pattern.map(layer => layer.join("|")).join("||");
    }
    /** Triggered on block update */
    detectStructure(dimension, block) {
        if (block.typeId !== this.triggerBlock)
            return;
        system.runJob(this.detectAllPatternsJob(dimension, block));
    }
    *detectAllPatternsJob(dimension, block) {
        const state = { isDone: false };
        for (const transformed of this.transformedPatterns) {
            if (state.isDone)
                return;
            const triggers = this.getTriggerBlockOffsets(transformed);
            for (const offset of triggers) {
                if (state.isDone)
                    return;
                const origin = {
                    x: Math.floor(block.location.x - offset.x),
                    y: Math.floor(block.location.y - offset.y),
                    z: Math.floor(block.location.z - offset.z),
                };
                yield* this.checkStructureJob(dimension, origin, transformed, state);
            }
        }
    }
    getTriggerBlockOffsets(pattern) {
        const offsets = [];
        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y].length; z++) {
                for (let x = 0; x < pattern[y][z].length; x++) {
                    if (this.patternTypes[pattern[y][z][x]] === this.triggerBlock) {
                        offsets.push({ x, y, z });
                    }
                }
            }
        }
        return offsets;
    }
    *checkStructureJob(dimension, origin, pattern, state) {
        if (state.isDone)
            return;
        let count = 0;
        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y].length; z++) {
                for (let x = 0; x < pattern[y][z].length; x++) {
                    const expected = this.patternTypes[pattern[y][z][x]];
                    if (!expected)
                        continue;
                    const pos = { x: origin.x + x, y: origin.y + y, z: origin.z + z };
                    const block = dimension.getBlock(pos);
                    if (!block || block.typeId !== expected)
                        return;
                    if (++count % 5 === 0)
                        yield;
                }
            }
        }
        if (state.isDone)
            return;
        state.isDone = true;
        yield* this.removeStructureChunkedJob(dimension, origin, pattern);
        this.summonEntity(dimension, origin);
    }
    *removeStructureChunkedJob(dimension, origin, pattern) {
        let count = 0;
        for (let y = 0; y < pattern.length; y++) {
            for (let z = 0; z < pattern[y].length; z++) {
                for (let x = 0; x < pattern[y][z].length; x++) {
                    if (this.patternTypes[pattern[y][z][x]]) {
                        const pos = {
                            x: origin.x + x,
                            y: origin.y + y,
                            z: origin.z + z,
                        };
                        const block = dimension.getBlock(pos);
                        block === null || block === void 0 ? void 0 : block.setType("minecraft:air");
                        if (++count % 5 === 0)
                            yield;
                    }
                }
            }
        }
    }
    // -------------------- Static Pattern Operations --------------------
    static rotateLayer(layer) {
        const rotated = [];
        for (let col = 0; col < layer[0].length; col++) {
            let row = "";
            for (let rowIndex = layer.length - 1; rowIndex >= 0; rowIndex--) {
                row += layer[rowIndex][col];
            }
            rotated.push(row);
        }
        return rotated;
    }
    static flipLayerHorizontal(layer) {
        return layer.map(row => row.split("").reverse().join(""));
    }
    static flipLayerVertical(layer) {
        return [...layer].reverse();
    }
    static flipEntirePattern(pattern) {
        return pattern.map(layer => this.flipLayerVertical(layer)).reverse();
    }
    static transposeYZ(pattern) {
        const result = [];
        for (let z = 0; z < pattern[0].length; z++) {
            const layer = [];
            for (let y = 0; y < pattern.length; y++) {
                layer.push([...pattern[y][z]].join(""));
            }
            result.push(layer);
        }
        return result;
    }
    static transposeXY(pattern) {
        const result = [];
        for (let y = 0; y < pattern.length; y++) {
            const layer = [];
            for (let x = 0; x < pattern[0][0].length; x++) {
                let row = "";
                for (let z = 0; z < pattern[0].length; z++) {
                    row += pattern[y][z][x];
                }
                layer.push(row);
            }
            result.push(layer);
        }
        return result;
    }
}
StructureDetector.instances = [];
export default StructureDetector;
//# sourceMappingURL=structureDetector.js.map