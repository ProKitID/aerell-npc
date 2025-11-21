import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, world, } from '@minecraft/server';
import { ActionFormData, } from '@minecraft/server-ui';
import StructureDetector from './modules/structureDetector';
const NAME = 'Aerell NPC';
const IDENTIFIER_PREFIX = 'aerell';
const VERSION = '1.0.0';
const NPC = 'npc';
const NPC_COMMAND_NAME = `${IDENTIFIER_PREFIX}:${NPC}`;
const NPC_COMMAND_ENUM_PREFIX_NAME = `${IDENTIFIER_PREFIX}:prefix`;
const NPC_ENTITY_TYPE_ID = NPC_COMMAND_NAME;
const npcCommand = {
    name: NPC_COMMAND_NAME,
    description: 'Aerell NPC Commands',
    permissionLevel: CommandPermissionLevel.Any,
    cheatsRequired: false,
    mandatoryParameters: [
        {
            name: NPC_COMMAND_ENUM_PREFIX_NAME,
            type: CustomCommandParamType.Enum
        }
    ]
};
const npcCommandCallBack = (origin, prefix) => {
    var _a;
    const source = (_a = origin.initiator) !== null && _a !== void 0 ? _a : origin.sourceEntity;
    if (!(source instanceof Player))
        return {
            status: CustomCommandStatus.Failure,
            message: 'This command can only be executed by players.'
        };
    if (prefix == 'version')
        return {
            status: CustomCommandStatus.Success,
            message: `§e${NAME} version ${VERSION}`
        };
    return {
        status: CustomCommandStatus.Failure
    };
};
system.beforeEvents.startup.subscribe((event) => {
    event.customCommandRegistry.registerEnum(NPC_COMMAND_ENUM_PREFIX_NAME, ['version']);
    event.customCommandRegistry.registerCommand(npcCommand, npcCommandCallBack);
});
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    var _a;
    const itemStack = event.itemStack;
    const player = event.player;
    const target = event.target;
    if (target.typeId == NPC_ENTITY_TYPE_ID && ((_a = itemStack === null || itemStack === void 0 ? void 0 : itemStack.typeId) !== null && _a !== void 0 ? _a : '') != 'minecraft:name_tag') {
        system.run(() => {
            var _a;
            new ActionFormData()
                .title('Aerell NPC - Menu')
                .label(`Name: ${target.nameTag}`)
                .label(`Health: ${(_a = target.getComponent('minecraft:health')) === null || _a === void 0 ? void 0 : _a.currentValue}`)
                .show(player).then((value) => {
                if (value.canceled)
                    return;
            });
        });
    }
});
const detector = new StructureDetector({
    "*": "minecraft:air",
    "d": "minecraft:dirt",
    "p": "minecraft:player_head" // the block that trigger the check.
}, [
    ["d"],
    ["d"],
    ["p"]
], (dimension, pos) => {
    dimension.spawnEntity(NPC_ENTITY_TYPE_ID, pos);
});
world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
    detector.detectStructure(dimension, block);
});
//# sourceMappingURL=main.js.map