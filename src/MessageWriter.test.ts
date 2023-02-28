import { parse as parseMessageDefinition } from "@foxglove/rosmsg";

import { MessageWriter } from "./MessageWriter";

const serializeString = (str: string): Uint8Array => {
  const data = Buffer.from(str, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.byteLength + 1, 0);
  return Uint8Array.from([...len, ...data, 0x00]);
};

const float32Buffer = (floats: number[]): Uint8Array => {
  return new Uint8Array(Float32Array.from(floats).buffer);
};

describe("MessageWriter", () => {
  it.each([
    [`int8 sample # lowest`, [0x80], { sample: -128 }],
    [`int8 sample # highest`, [0x7f], { sample: 127 }],
    [`uint8 sample # lowest`, [0x00], { sample: 0 }],
    [`uint8 sample # highest`, [0xff], { sample: 255 }],
    [`int16 sample # lowest`, [0x00, 0x80], { sample: -32768 }],
    [`int16 sample # highest`, [0xff, 0x7f], { sample: 32767 }],
    [`uint16 sample # lowest`, [0x00, 0x00], { sample: 0 }],
    [`uint16 sample # highest`, [0xff, 0xff], { sample: 65535 }],
    [`int32 sample # lowest`, [0x00, 0x00, 0x00, 0x80], { sample: -2147483648 }],
    [`int32 sample # highest`, [0xff, 0xff, 0xff, 0x7f], { sample: 2147483647 }],
    [`uint32 sample # lowest`, [0x00, 0x00, 0x00, 0x00], { sample: 0 }],
    [`uint32 sample # highest`, [0xff, 0xff, 0xff, 0xff], { sample: 4294967295 }],
    [
      `int64 sample # lowest`,
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80],
      { sample: -9223372036854775808n },
    ],
    [
      `int64 sample # highest`,
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f],
      { sample: 9223372036854775807n },
    ],
    [`uint64 sample # lowest`, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], { sample: 0n }],
    [
      `uint64 sample # highest`,
      [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
      { sample: 18446744073709551615n },
    ],
    [`float32 sample`, float32Buffer([5.5]), { sample: 5.5 }],
    [
      `float64 sample`,
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      new Uint8Array(Float64Array.of(0.123456789121212121212).buffer),
      // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
      { sample: 0.123456789121212121212 },
    ],
    [
      `builtin_interfaces/Time stamp`,
      [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
      {
        stamp: {
          sec: 0,
          nsec: 1,
        },
      },
    ],
    [
      `builtin_interfaces/Duration stamp`,
      [0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
      {
        stamp: {
          sec: 0,
          nsec: 1,
        },
      },
    ],
    [
      `int32[] arr`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...new Uint8Array(Int32Array.of(3, 7).buffer),
      ],
      { arr: Int32Array.from([3, 7]) },
    ],
    [
      `time[1] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
      { arr: [{ sec: 1, nsec: 2 }] },
    ],
    [
      `duration[1] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
      { arr: [{ sec: 1, nsec: 2 }] },
    ],
    [
      `time[] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      { arr: [{ sec: 2, nsec: 3 }] },
    ],
    [
      `duration[] arr`,
      [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      { arr: [{ sec: 2, nsec: 3 }] },
    ],
    // unaligned access
    [
      `uint8 blank\nint32[] arr`,
      [
        0x00,
        ...[0x00, 0x00, 0x00], // alignment
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...new Uint8Array(Int32Array.of(3, 7).buffer),
      ],
      { blank: 0, arr: Int32Array.from([3, 7]) },
    ],
    [
      `uint8 blank\ntime[] arr`,
      [
        0x00,
        ...[0x00, 0x00, 0x00], // alignment
        ...[0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00],
      ],
      { blank: 0, arr: [{ sec: 2, nsec: 3 }] },
    ],
    [`float32[2] arr`, float32Buffer([5.5, 6.5]), { arr: Float32Array.from([5.5, 6.5]) }],
    [
      `uint8 blank\nfloat32[2] arr`,
      [
        0x00,
        ...[0x00, 0x00, 0x00], // alignment
        ...float32Buffer([5.5, 6.5]),
      ],
      { blank: 0, arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `float32[] arr`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
      ],
      { arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `uint8 blank\nfloat32[] arr`,
      [
        0x00,
        ...[0x00, 0x00, 0x00], // alignment
        ...[0x02, 0x00, 0x00, 0x00],
        ...float32Buffer([5.5, 6.5]),
      ],
      { blank: 0, arr: Float32Array.from([5.5, 6.5]) },
    ],
    [
      `float32[] first\nfloat32[] second`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...float32Buffer([5.5, 6.5]),
      ],
      {
        first: Float32Array.from([5.5, 6.5]),
        second: Float32Array.from([5.5, 6.5]),
      },
    ],
    [`string sample # empty string`, serializeString(""), { sample: "" }],
    [`string sample # some string`, serializeString("some string"), { sample: "some string" }],
    [`int8[4] first`, [0x00, 0xff, 0x80, 0x7f], { first: new Int8Array([0, -1, -128, 127]) }],
    [
      `int8[] first`,
      [
        ...[0x04, 0x00, 0x00, 0x00], // length
        0x00,
        0xff,
        0x80,
        0x7f,
      ],
      { first: new Int8Array([0, -1, -128, 127]) },
    ],
    [`uint8[4] first`, [0x00, 0xff, 0x80, 0x7f], { first: new Uint8Array([0, -1, -128, 127]) }],
    [
      `string[2] first`,
      [...serializeString("one"), ...serializeString("longer string")],
      { first: ["one", "longer string"] },
    ],
    [
      `string[] first`,
      [
        ...[0x02, 0x00, 0x00, 0x00], // length
        ...serializeString("one"),
        ...serializeString("longer string"),
      ],
      { first: ["one", "longer string"] },
    ],
    // first size value after fixed size value
    [`int8 first\nint8 second`, [0x80, 0x7f], { first: -128, second: 127 }],
    [
      `string first\nint8 second`,
      [...serializeString("some string"), 0x80],
      { first: "some string", second: -128 },
    ],
    [
      `CustomType custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [0x02],
      {
        custom: { first: 0x02 },
      },
    ],
    [
      `CustomType[3] custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [0x02, 0x03, 0x04],
      {
        custom: [{ first: 0x02 }, { first: 0x03 }, { first: 0x04 }],
      },
    ],
    [
      `CustomType[] custom
    ============
    MSG: custom_type/CustomType
    uint8 first`,
      [
        ...[0x03, 0x00, 0x00, 0x00], // length
        0x02,
        0x03,
        0x04,
      ],
      {
        custom: [{ first: 0x02 }, { first: 0x03 }, { first: 0x04 }],
      },
    ],
    // ignore constants
    [
      `int8 STATUS_ONE = 1
       int8 STATUS_TWO = 2
       int8 status`,
      [0x02],
      { status: 2 },
    ],
    // An array of custom types which themselves have a custom type
    // This tests an array's ability to properly size custom types
    [
      `CustomType[] custom
    ============
    MSG: custom_type/CustomType
    MoreCustom another
    ============
    MSG: custom_type/MoreCustom
    uint8 field`,
      [
        ...[0x03, 0x00, 0x00, 0x00], // length
        0x02,
        0x03,
        0x04,
      ],
      {
        custom: [
          { another: { field: 0x02 } },
          { another: { field: 0x03 } },
          { another: { field: 0x04 } },
        ],
      },
    ],
  ])(
    "should serialize %s",
    (msgDef: string, arr: Iterable<number>, message: Record<string, unknown>) => {
      const expected = Uint8Array.from([0, 1, 0, 0, ...arr]);
      const writer = new MessageWriter(parseMessageDefinition(msgDef, { ros2: true }));
      const written = writer.writeMessage(message);

      expect(written).toBytesEqual(expected);
      expect(writer.calculateByteSize(message)).toEqual(expected.byteLength);
    },
  );

  it("should serialize a ROS 2 log message", () => {
    const expected = Uint8Array.from(
      Buffer.from(
        "00010000fb65865e80faae0614000000120000006d696e696d616c5f7075626c69736865720000001e0000005075626c697368696e673a202748656c6c6f2c20776f726c64212030270000004c0000002f6f70742f726f73325f77732f656c6f7175656e742f7372632f726f73322f6578616d706c65732f72636c6370702f6d696e696d616c5f7075626c69736865722f6c616d6264612e637070000b0000006f70657261746f722829000026000000",
        "hex",
      ),
    );
    const msgDef = `
    byte DEBUG=10
    byte INFO=20
    byte WARN=30
    byte ERROR=40
    byte FATAL=50
    ##
    ## Fields
    ##
    builtin_interfaces/Time stamp
    uint8 level
    string name # name of the node
    string msg # message
    string file # file the message came from
    string function # function the message came from
    uint32 line # line the message came from
    `;
    const writer = new MessageWriter(parseMessageDefinition(msgDef, { ros2: true }));
    const message = {
      stamp: { sec: 1585866235, nsec: 112130688 },
      level: 20,
      name: "minimal_publisher",
      msg: "Publishing: 'Hello, world! 0'",
      file: "/opt/ros2_ws/eloquent/src/ros2/examples/rclcpp/minimal_publisher/lambda.cpp",
      function: "operator()",
      line: 38,
    };
    const written = writer.writeMessage(message);
    expect(written).toBytesEqual(expected);
    expect(writer.calculateByteSize(message)).toEqual(expected.byteLength);
  });

  it("should serialize a ROS 2 tf2_msgs/TFMessage", () => {
    const expected = Uint8Array.from(
      Buffer.from(
        "0001000001000000286fae6169ddd73108000000747572746c6531000e000000747572746c65315f616865616400000000000000000000000000f03f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f03f",
        "hex",
      ),
    );
    const msgDef = `
    geometry_msgs/msg/TransformStamped[] transforms
    ================================================================================
    MSG: geometry_msgs/msg/TransformStamped
    Header header
    string child_frame_id # the frame id of the child frame
    Transform transform
    ================================================================================
    MSG: std_msgs/msg/Header
    builtin_interfaces/Time stamp
    string frame_id
    ================================================================================
    MSG: geometry_msgs/msg/Transform
    Vector3 translation
    Quaternion rotation
    ================================================================================
    MSG: geometry_msgs/msg/Vector3
    float64 x
    float64 y
    float64 z
    ================================================================================
    MSG: geometry_msgs/msg/Quaternion
    float64 x
    float64 y
    float64 z
    float64 w
    `;
    const writer = new MessageWriter(parseMessageDefinition(msgDef, { ros2: true }));
    const message = {
      transforms: [
        {
          header: {
            stamp: { sec: 1638821672, nsec: 836230505 },
            frame_id: "turtle1",
          },
          child_frame_id: "turtle1_ahead",
          transform: {
            translation: { x: 1, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        },
      ],
    };
    const written = writer.writeMessage(message);
    expect(written).toBytesEqual(expected);
    expect(writer.calculateByteSize(message)).toEqual(expected.byteLength);
  });
});
